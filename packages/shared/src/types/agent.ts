import type { CardBlock, ContentType, CoverSpec, PageOverlay } from './deck.js';
import type { LayoutReport } from './layout.js';

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

/** 与具体模型厂商解耦的消息格式，后端负责翻译成各家协议 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content?: string;
}

export interface AgentStepResponse {
  message: AgentMessage;
  finishReason: 'stop' | 'length';
  usage?: { promptTokens: number; completionTokens: number };
}

export type AgentPhase = 'idle' | 'drafting' | 'measuring' | 'done' | 'failed';

export interface AgentRunState {
  phase: AgentPhase;
  report?: LayoutReport;
  /** 当前在做什么，直接展示给用户 */
  note?: string;
  error?: string;
}
