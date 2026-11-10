import { Injectable, Logger } from '@nestjs/common';
import {
  TARGET_CARDS,
  TARGET_IMAGES,
  THEMES,
  XHS,
  sourceUnits,
  type AgentMessage,
  type AgentStepResponse,
  type DraftProposal,
} from '@rcs/shared';
import { ArticlesService } from '../articles/articles.service';
import { DecksService } from '../decks/decks.service';
import { PromptsService } from '../prompts/prompts.service';
import { LlmService } from './llm.service';
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
      { role: 'system', content: await this.systemPrompt() },
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

  private async load(deckId: string, userId: string) {
    const deck = await this.decks.get(deckId, userId);
    const article = await this.articles.get(deck.articleId, userId);
    return { deck, article };
  }

  /** 写作规则全集：写作风格、封面规则、平台硬约束和各内容类型的张数 */
  async systemPrompt(): Promise<string> {
    const [style, cover, main] = await Promise.all([
      this.prompts.get('style'),
      this.prompts.get('cover'),
      this.prompts.get('draft'),
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
