import type { CardBlock, CardBlockKind, ContentType, CoverSpec, BreakHint, PageOverlay } from './deck.js';
import type { LayoutReport } from './layout.js';

/** 迭代轮次上限。Agent 每轮都是一次完整的模型往返，不设上限会把等待和成本拖垮 */
export const MAX_AGENT_ROUNDS = 5;

/** 热启动的产出：一次调用拿到可直接渲染的完整初稿 */
export interface DraftProposal {
  contentType: ContentType;
  targetCards: number;
  /** 为什么判成这个类型、为什么定这个张数，展示给用户看 */
  rationale: string;
  blocks: CardBlock[];
  cover: CoverSpec;
  themeId?: string;
  accentId?: string;
  /** 页眉的话题和页脚的系列名，每篇不同 */
  topic?: string;
  series?: string;
  overlays?: PageOverlay[];
}

/**
 * 外部 Agent（比如 Cursor 里的任意模型）写初稿要的材料：和内置 AI 拿到的是同一套规则、同一份原文和输出格式。
 * 外部 Agent 自己按这些写出初稿 JSON 再交回来，不经过工具配置的大模型
 */
export interface DraftBrief {
  deckId: string;
  articleId: string;
  title: string;
  /** 写作规则全集 */
  rules: string;
  /** 压成行式文本的原文，带章节号、配图 id 和章节清单 */
  article: string;
  /** 初稿 JSON 的结构说明 */
  outputSpec: string;
}

/** 外部初稿或补章落库后的对账结果 */
export interface DraftImportResult {
  deckId: string;
  /** 编辑台地址，打开就能看到排好的卡片 */
  editorUrl: string;
  contentType: ContentType;
  themeId: string;
  blockCount: number;
  chapterCount: number;
  imageCount: number;
  /** 原文里没被任何 h2 认领的核心节，要再补写一次 */
  missing: Array<{ id: string; title: string }>;
  /** 有漏节时的补写要求，和内置 AI 追问补写用的是同一段话 */
  gapBrief?: string;
}

/**
 * 对块流的增量修改。用补丁而不是全量替换，
 * 是因为迭代轮次里重传整份块流会让每轮输出都很长，既慢又容易被截断。
 *
 * 字段刻意做成扁平结构而不是可辨识联合：部分厂商对 JSON Schema 的 oneOf
 * 支持很差，扁平结构在各家模型上都能稳定产出。
 */
export interface BlockPatch {
  op: 'replace' | 'remove' | 'insert' | 'setBreak';
  /** insert 时表示插入位置的锚点，内容插在这一块之后；留空表示插到最前面 */
  blockId: string;
  block?: Partial<CardBlock>;
  hint?: BreakHint | null;
}

export type AgentToolName =
  | 'measure_layout'
  | 'revise_blocks'
  | 'revise_cover'
  | 'adjust_settings'
  | 'finish';

export interface AgentToolCall {
  id: string;
  name: AgentToolName;
  args: unknown;
  /** 参数不是合法 JSON（多半是太长被截断）时的原因，执行前要先回报给模型 */
  parseError?: string;
}

export interface AgentToolResult {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** measure_layout 的返回。页面摘要让模型知道每一页在讲什么，否则它无从判断该改哪页 */
export interface LayoutSnapshot {
  report: LayoutReport;
  pages: Array<{
    index: number;
    fill: number;
    overflow: boolean;
    /** 逐块列出 id 和摘要。只给 id 列表时模型对不上号，插入和替换的锚点经常选错；h2 带上它讲的原文节号 */
    blocks: Array<{ id: string; kind: CardBlockKind; text: string; sources?: string[] }>;
    /** 过空页的具体改法，模型光看页码不知道该补多少 */
    advice?: string;
  }>;
  /**
   * 原文里还没用上的截图，小图已经滤掉。补图和填空页都从这里挑，模型自己翻原文常常漏看。
   * source 是它在原文里所属的节，只能放进 sources 含这一节的章节
   */
  unusedImages: Array<{ id: string; source: string }>;
}

/** 编辑台回传的一次测高结果。key 是测量那一版内容的 layoutKey，服务端靠它判断快照是不是过期了 */
export interface LayoutUpload {
  key: string;
  snapshot: LayoutSnapshot;
}

/**
 * 外部 Agent 读到的排版体检。测高只有浏览器能做，所以要编辑台开着、量完当前这版才有结果：
 * fresh 量的就是库里当前这版；stale 编辑台还没量到最新改动；missing 编辑台还没打开过这份稿
 */
export interface ExternalLayout {
  deckId: string;
  editorUrl: string;
  status: 'fresh' | 'stale' | 'missing';
  snapshot?: LayoutSnapshot;
  /** 逐条点名这一轮要改什么，和内置 AI 每轮拿到的是同一段话 */
  todo?: string;
  /** 有问题的页上每一块的完整内容，replace 时照着改，不用再去猜条目原文 */
  problemBlocks?: CardBlock[];
  /** 修版规则，和内置 AI 迭代时拿到的是同一份 */
  rules?: string;
}

export interface ExternalReviseResult {
  deckId: string;
  editorUrl: string;
  applied: number;
  /** 没生效的补丁和原因，模型要据此重写，不然它会以为改动已经生效 */
  skipped: string[];
}

/** 编辑台轮询用：外部 Agent 最近一次改稿的时间戳，变了就重新加载。服务重启后为空 */
export interface DeckSync {
  externalRevision: number | null;
}

export interface ReviseBlocksArgs {
  patches: BlockPatch[];
  reason: string;
}

export interface ReviseCoverArgs {
  cover: Partial<CoverSpec>;
  reason: string;
}

export interface AdjustSettingsArgs {
  fontSize?: number;
  imageScale?: number;
  targetCards?: number;
  reason: string;
}

export interface FinishArgs {
  summary: string;
}

export interface RewritePageInput {
  index: number;
  isCover: boolean;
  blockIds: string[];
}

export interface RewritePageGroup {
  removeIds: string[];
  insert: CardBlock[];
}

export interface RewritePagesResult {
  cover?: CoverSpec;
  groups: RewritePageGroup[];
  overlays: PageOverlay[];
  replacedIds: string[];
  coverReplaced: boolean;
}

/** 与具体模型厂商解耦的消息格式，后端负责翻译成各家协议 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: AgentToolCall[];
  toolCallId?: string;
}

export interface AgentStepRequest {
  deckId: string;
  messages: AgentMessage[];
  model?: string;
}

export interface AgentStepResponse {
  message: AgentMessage;
  finishReason: 'stop' | 'tool_calls' | 'length';
  usage?: { promptTokens: number; completionTokens: number };
}

export type AgentPhase = 'idle' | 'drafting' | 'measuring' | 'revising' | 'done' | 'failed';

export interface AgentRunState {
  phase: AgentPhase;
  round: number;
  maxRounds: number;
  report?: LayoutReport;
  /** 当前在做什么，直接展示给用户 */
  note?: string;
  error?: string;
}
