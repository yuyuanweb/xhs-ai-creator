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
