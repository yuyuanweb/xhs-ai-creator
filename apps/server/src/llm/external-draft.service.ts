import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  adoptAiEdits,
  applyDraft,
  applyPatches,
  buildArticleIndex,
  copyIssues,
  isRevisionDone,
  layoutKey,
  layoutTodo,
  sourceUnits,
  type BlockPatch,
  type CardBlock,
  type Deck,
  type DraftBrief,
  type DraftImportResult,
  type ExternalLayout,
  type ExternalReviseResult,
  type LayoutSnapshot,
} from '@rcs/shared';
import { ArticlesService } from '../articles/articles.service';
import { DeckLayoutStore } from '../decks/deck-layout.store';
import { DecksService } from '../decks/decks.service';
import { AgentService } from './agent.service';
import { renderArticleContext } from './article-context';
import { DraftBlocks, mergeChapters, type RawBlock } from './draft-blocks';
import { DRAFT_OUTPUT_SPEC, gapBrief, normalizeDraft, type RawDraft } from './draft-spec';

/**
 * 外部 Agent 写稿：Cursor 里的任意模型读规则和原文、自己写出初稿 JSON 交回来，不调用工具配置的大模型。
 * 收稿走和内置 AI 完全相同的清洗、截图校验和章节对账，所以两条路径交出的稿子一样经得起检查。
 * 修版也一样：读编辑台量出来的真实排版，按块 id 打补丁，只动有问题的页
 */
@Injectable()
export class ExternalDraftService {
  private readonly webOrigin: string;

  constructor(
    private readonly agent: AgentService,
    private readonly articles: ArticlesService,
    private readonly decks: DecksService,
    private readonly layouts: DeckLayoutStore,
    config: ConfigService,
  ) {
    const origin = config.get<string>('WEB_ORIGIN') ?? config.get<string>('CORS_ORIGIN', 'http://localhost:18473').split(',')[0]!;
    this.webOrigin = origin.trim().replace(/\/+$/, '');
  }

  async brief(deckId: string, userId: string): Promise<DraftBrief> {
    const { article } = await this.load(deckId, userId);
    return {
      deckId,
      articleId: article.id,
      title: article.title,
      rules: await this.agent.systemPrompt('draft'),
      article: renderArticleContext(article),
      outputSpec: DRAFT_OUTPUT_SPEC,
    };
  }

  /** 整份初稿覆盖原稿。人工关掉的块一并清空，和编辑台里重新生成初稿的行为一致 */
  async importDraft(deckId: string, userId: string, raw: RawDraft): Promise<DraftImportResult> {
    const { deck, article } = await this.load(deckId, userId);
    const drafter = new DraftBlocks(article, sourceUnits(article.blocks));
    const { contentType, blocks, cover, settings, disabledBlockIds, overlays, aiSnapshot, status } = applyDraft(
      deck,
      normalizeDraft(raw, article, drafter),
    );
    const saved = await this.decks.update(deckId, userId, {
      contentType,
      blocks,
      cover,
      settings,
      disabledBlockIds,
      overlays,
      aiSnapshot,
      status,
    });
    this.layouts.markExternalChange(deckId);
    return this.reconcile(saved, drafter);
  }

  /** 只补漏掉的章节，按原文顺序插回已有的稿子里，不动已经写好的页 */
  async supplement(deckId: string, userId: string, raw: RawBlock[]): Promise<DraftImportResult> {
    const { deck, article } = await this.load(deckId, userId);
    const units = sourceUnits(article.blocks);
    const drafter = new DraftBlocks(article, units, deck.blocks);
    const extra = drafter.normalize(raw);
    if (!extra.length) throw new BadRequestException('补写的块全部无效：检查 kind、imageId 和各组件的必填字段');

    const blocks = mergeChapters(deck.blocks, extra, units);
    const saved = await this.decks.update(deckId, userId, {
      blocks,
      aiSnapshot: adoptAiEdits(deck.aiSnapshot, deck.blocks, blocks),
      status: 'ready',
    });
    this.layouts.markExternalChange(deckId);
    return this.reconcile(saved, drafter);
  }

  /** 编辑台量出来的真实排版。快照对不上库里当前这版就不给，旧分页只会让模型改错页 */
  async layout(deckId: string, userId: string): Promise<ExternalLayout> {
    const deck = await this.decks.get(deckId, userId);
    const base = { deckId, editorUrl: this.editorUrl(deckId) };
    const upload = this.layouts.layout(deckId);
    if (!upload) return { ...base, status: 'missing' };
    if (upload.key !== layoutKey(deck)) return { ...base, status: 'stale' };

    const { snapshot } = upload;
    if (isRevisionDone(snapshot, deck.blocks)) return { ...base, status: 'fresh', snapshot };
    return {
      ...base,
      status: 'fresh',
      snapshot,
      todo: layoutTodo(snapshot, deck.blocks),
      problemBlocks: problemBlocks(deck, snapshot),
      rules: await this.agent.systemPrompt('revise'),
    };
  }

  /** 按块 id 打补丁，校验规则和编辑台里内置 AI 修版完全相同 */
  async revise(deckId: string, userId: string, patches: BlockPatch[]): Promise<ExternalReviseResult> {
    const { deck, article } = await this.load(deckId, userId);
    const { blocks, applied, skipped } = applyPatches(deck.blocks, patches, buildArticleIndex(article));
    if (applied) {
      await this.decks.update(deckId, userId, {
        blocks,
        aiSnapshot: adoptAiEdits(deck.aiSnapshot, deck.blocks, blocks),
      });
      this.layouts.markExternalChange(deckId);
    }
    return { deckId, editorUrl: this.editorUrl(deckId), applied, skipped };
  }

  private async load(deckId: string, userId: string) {
    const deck = await this.decks.get(deckId, userId);
    const article = await this.articles.get(deck.articleId, userId);
    return { deck, article };
  }

  private editorUrl(deckId: string): string {
    return `${this.webOrigin}/decks/${deckId}`;
  }

  private reconcile(deck: Deck, drafter: DraftBlocks): DraftImportResult {
    const missing = drafter.uncovered(deck.blocks);
    return {
      deckId: deck.id,
      editorUrl: this.editorUrl(deck.id),
      contentType: deck.contentType,
      themeId: deck.settings.themeId,
      blockCount: deck.blocks.length,
      chapterCount: deck.blocks.filter((b) => b.kind === 'h2').length,
      imageCount: deck.blocks.filter((b) => b.kind === 'image').length,
      missing: missing.map((u) => ({ id: u.id, title: u.title })),
      ...(missing.length ? { gapBrief: gapBrief(missing) } : {}),
    };
  }
}

/** 溢出页、过空页上的块和文案有问题的块原样给出。快照里只有截断的摘要，模型照着摘要 replace 会把条目写丢 */
function problemBlocks(deck: Deck, snapshot: LayoutSnapshot): CardBlock[] {
  const bad = new Set([...snapshot.report.overflowPages, ...snapshot.report.thinPages]);
  const ids = new Set([
    ...snapshot.pages.filter((p) => bad.has(p.index)).flatMap((p) => p.blocks.map((b) => b.id)),
    ...copyIssues(deck.blocks).map((i) => i.blockId),
  ]);
  return deck.blocks.filter((b) => ids.has(b.id));
}
