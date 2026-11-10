import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DECOR_EMOJIS,
  DECOR_ICONS,
  TARGET_CARDS,
  TARGET_IMAGES,
  THEMES,
  XHS,
  normalizeOverlays,
  sourceUnits,
  upgradeCover,
  type AgentMessage,
  type AgentStepResponse,
  type CardBlock,
  type DraftProposal,
  type RewritePageInput,
  type RewritePagesResult,
} from '@rcs/shared';
import { ArticlesService } from '../articles/articles.service';
import { DecksService } from '../decks/decks.service';
import { PromptsService } from '../prompts/prompts.service';
import { LlmService } from './llm.service';
import { AGENT_TOOLS } from './tools';
import { renderArticleContext } from './article-context';
import { DraftBlocks, mergeChapters, type RawBlock } from './draft-blocks';
import { CONTENT_TYPES, DRAFT_OUTPUT_SPEC, gapBrief, normalizeDraft, type RawDraft } from './draft-spec';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly prompts: PromptsService,
    private readonly articles: ArticlesService,
    private readonly decks: DecksService,
  ) {}

  /**
   * 热启动：一次调用拿到完整初稿，用户几十秒内就能看到成品长什么样。
   * 长文的后半部分模型常常草草略过甚至整段不写，所以交稿前按原文章节清单对一遍账，
   * 漏掉的核心节再追问一次补写，按原文顺序插回去
   */
  async draft(deckId: string, userId: string, model?: string): Promise<DraftProposal> {
    const { article } = await this.load(deckId, userId);
    this.logger.log(`开始生成初稿 deck=${deckId} 字数=${article.markdown.length}`);

    const conversation: AgentMessage[] = [
      { role: 'system', content: await this.systemPrompt('draft') },
      { role: 'user', content: `${renderArticleContext(article)}\n\n${DRAFT_OUTPUT_SPEC}` },
    ];
    const res = await this.llm.chat(conversation, { model, jsonMode: true });
    const raw = this.llm.parseJson<RawDraft>(res.message.content);

    const drafter = new DraftBlocks(article, sourceUnits(article.blocks));
    const proposal = normalizeDraft(raw, article, drafter);

    const missing = drafter.uncovered(proposal.blocks);
    if (!missing.length) return proposal;

    this.logger.log(`初稿漏了 ${missing.length} 节，追问补写：${missing.map((u) => u.id).join(',')}`);
    const gapRequest = `${gapBrief(missing)}\n只输出 JSON：{ "blocks": [ 和初稿 blocks 结构相同的块 ] }`;
    // 补写失败时退回原稿，漏掉的章节总比整份初稿作废好
    try {
      const gap = await this.llm.chat(
        [...conversation, { role: 'assistant', content: res.message.content }, { role: 'user', content: gapRequest }],
        { model, jsonMode: true },
      );
      const extra = drafter.normalize(this.llm.parseJson<{ blocks?: RawBlock[] }>(gap.message.content).blocks);
      return { ...proposal, blocks: mergeChapters(proposal.blocks, extra, drafter.units) };
    } catch (err) {
      this.logger.warn(`补写漏掉的章节失败：${(err as Error).message}`);
      return proposal;
    }
  }

  async rewritePages(deckId: string, userId: string, pages: RewritePageInput[], model?: string): Promise<RewritePagesResult> {
    const { deck, article } = await this.load(deckId, userId);
    const coverPage = pages.find((p) => p.isCover);
    const content = pages.filter((p) => !p.isCover && p.blockIds.length);
    if (!coverPage && !content.length) throw new BadRequestException('没有要重新生成的页');

    const replacedIds = content.flatMap((p) => p.blockIds);
    const existing = deck.blocks.filter((b) => !replacedIds.includes(b.id));
    const drafter = new DraftBlocks(article, sourceUnits(article.blocks), existing);

    const briefs = content.map((p) => describePage(deck.blocks, p.blockIds, p.index));
    const conversation: AgentMessage[] = [
      { role: 'system', content: await this.systemPrompt('draft') },
      {
        role: 'user',
        content: [
          renderArticleContext(article),
          '',
          '只重写下面这些页，不要动没列出的页。每页仍是一个 h2 加本页组件；原来的 h2 有 sources 就沿用，不要改章节认领。',
          '有「给 AI 的批注」的页，按批注来改，批注优先于原来的写法。',
          coverPage ? `封面也要重写。当前封面：\n${JSON.stringify(deck.cover)}` : '封面不要改。',
          '',
          ...briefs.map((b) => b.text),
          '',
          '只输出 JSON：',
          '{ "cover": { 封面对象，没要求重写封面就省略 }, "pages": [{ "index": 页码, "blocks": [和初稿 blocks 相同] }], "overlays": [只给这些页的装饰] }',
          `素材库表情：${DECOR_EMOJIS.map((e) => e.emoji).join(' ')}`,
          `素材库图标：${DECOR_ICONS.map((i) => i.id).join(' / ')}`,
        ].join('\n'),
      },
    ];

    const res = await this.llm.chat(conversation, { model, jsonMode: true });
    const raw = this.llm.parseJson<{ cover?: DraftProposal['cover']; pages?: Array<{ index?: number; blocks?: RawBlock[] }>; overlays?: unknown }>(
      res.message.content,
    );

    const groups = content.map((p, i) => {
      const old = deck.blocks.filter((b) => p.blockIds.includes(b.id));
      const matched = raw.pages?.find((x) => x.index === p.index) ?? raw.pages?.[i];
      let insert = drafter.normalize(matched?.blocks);
      const oldH2 = old.find((b) => b.kind === 'h2');
      if (oldH2 && !insert.some((b) => b.kind === 'h2')) insert = [oldH2, ...insert];
      else if (oldH2) {
        insert = insert.map((b) => (b.kind === 'h2' && !b.sources?.length ? { ...b, sources: oldH2.sources } : b));
      }
      if (!insert.length) insert = old;
      return { removeIds: p.blockIds, insert };
    });

    const inserted = groups.flatMap((g) => g.insert);
    const mergedBlocks = deck.blocks.map((b) => (replacedIds.includes(b.id) ? null : b)).filter(Boolean) as CardBlock[];
    const preview = [...mergedBlocks, ...inserted];
    return {
      ...(coverPage ? { cover: upgradeCover({ ...deck.cover, ...(raw.cover ?? {}) }, deck.settings.themeId) } : {}),
      groups,
      overlays: normalizeOverlays(raw.overlays, preview),
      replacedIds,
      coverReplaced: Boolean(coverPage),
    };
  }

  async rewriteBlock(deckId: string, userId: string, blockId: string, model?: string): Promise<CardBlock> {
    const { deck, article } = await this.load(deckId, userId);
    const block = deck.blocks.find((b) => b.id === blockId);
    if (!block) throw new BadRequestException('找不到这一块');

    const chapter = nearestChapter(deck.blocks, blockId);
    const drafter = new DraftBlocks(article, sourceUnits(article.blocks), deck.blocks.filter((b) => b.id !== blockId));
    const res = await this.llm.chat(
      [
        { role: 'system', content: await this.systemPrompt('draft') },
        {
          role: 'user',
          content: [
            renderArticleContext(article),
            '',
            `只重写这一块，kind 尽量保持 ${block.kind}，除非批注要求换成别的组件。`,
            chapter?.sources?.length ? `它属于原文 ${chapter.sources.join('、')}。` : '',
            block.note?.trim() ? `给 AI 的批注：${block.note.trim()}` : '没有批注，按原文把这一块写得更清楚、更像人话。',
            '',
            `当前内容：\n${JSON.stringify({ ...block, id: undefined })}`,
            '',
            '只输出 JSON：{ "block": { 和初稿 blocks 里的一块相同，不要写 id } }',
          ].join('\n'),
        },
      ],
      { model, jsonMode: true },
    );
    const raw = this.llm.parseJson<{ block?: RawBlock }>(res.message.content);
    const [next] = drafter.normalize(raw.block ? [raw.block] : []);
    if (!next) throw new BadRequestException('模型没有写出有效的块');
    return { ...next, id: block.id, ...(block.kind === 'h2' && block.sources ? { sources: next.sources ?? block.sources } : {}) };
  }

  /**
   * 迭代一步。后端每次重建系统提示词和原文上下文，
   * 前端只需要回传对话轮次，省掉每步都把整篇文章推上网络。
   */
  async step(deckId: string, userId: string, messages: AgentMessage[], model?: string): Promise<AgentStepResponse> {
    const { article } = await this.load(deckId, userId);

    return this.llm.chat(
      [
        { role: 'system', content: await this.systemPrompt('revise') },
        { role: 'user', content: renderArticleContext(article) },
        ...messages,
      ],
      { model, tools: AGENT_TOOLS, temperature: 0.4 },
    );
  }

  private async load(deckId: string, userId: string) {
    const deck = await this.decks.get(deckId, userId);
    const article = await this.articles.get(deck.articleId, userId);
    return { deck, article };
  }

  /** 写作规则全集。外部 Agent 写初稿时拿到的也是这一份，两边才写得出同一种稿子 */
  async systemPrompt(stage: 'draft' | 'revise'): Promise<string> {
    const [style, cover, main] = await Promise.all([
      this.prompts.get('style'),
      this.prompts.get('cover'),
      this.prompts.get(stage),
    ]);

    return [
      main,
      '',
      '## 写作风格（必须严格遵守）',
      style,
      '',
      '## 封面文案规则',
      cover,
      '',
      '## 平台硬约束',
      `单帖图片上限 ${XHS.MAX_IMAGES} 张，超了发不出去。官方建议 ${XHS.RECOMMENDED_MIN}-${XHS.RECOMMENDED_MAX} 张，页数越多滑到最后的人越少。`,
      `笔记正文字数上限 ${XHS.BODY_TEXT_LIMIT} 字，所以内容必须进图片，正文只写引导语。`,
      '封面底部约 15% 会被信息流 UI 遮挡，重要信息不能放在那里。',
      '',
      '## 各内容类型的目标张数',
      CONTENT_TYPES.map((t) => `${t}：${TARGET_CARDS[t].min}-${TARGET_CARDS[t].max} 张`).join('；'),
      '',
      '## 各内容类型的截图张数（原文可用的截图不够下限时全用上）',
      CONTENT_TYPES.map((t) => `${t}：${TARGET_IMAGES[t].min}-${TARGET_IMAGES[t].max} 张`).join('；'),
      '',
      '## 可选主题和强调色',
      THEMES.map(
        (t) =>
          `${t.id}（${t.name}）：${t.description}。强调色 accentId 可选 ${t.accents.map((a) => `${a.id}（${a.name}）`).join('、')}，第一个是默认`,
      ).join('\n'),
    ].join('\n');
  }
}

function describePage(blocks: CardBlock[], blockIds: string[], index: number) {
  const page = blocks.filter((b) => blockIds.includes(b.id));
  const chapter = page.find((b) => b.kind === 'h2') ?? nearestChapter(blocks, blockIds[0] ?? '');
  const notes = page.map((b) => b.note?.trim()).filter(Boolean);
  return {
    text: [
      `第 ${index + 1} 张（页码 ${index}）${chapter?.sources?.length ? `，sources=${JSON.stringify(chapter.sources)}` : ''}`,
      notes.length ? `给 AI 的批注：${notes.join('；')}` : '',
      `当前块：\n${JSON.stringify(page.map(({ id: _id, ...rest }) => rest))}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function nearestChapter(blocks: CardBlock[], blockId: string): CardBlock | undefined {
  const at = blocks.findIndex((b) => b.id === blockId);
  if (at < 0) return undefined;
  for (let i = at; i >= 0; i--) {
    if (blocks[i]!.kind === 'h2') return blocks[i];
  }
  return undefined;
}
