import type { AgentRunState, DraftProposal, LayoutReport } from '@rcs/shared';
import { agentApi } from '../api/endpoints';

/**
 * Agent 与卡片稿之间的全部接触面。
 * 流程本身不碰 React，所有状态改动都通过这几个回调交出去。
 */
export interface AgentContext {
  applyDraft: (proposal: DraftProposal) => void;
  /** 等重新测高和分页落定后返回真实排版结果 */
  measure: () => Promise<LayoutReport>;
  onState: (state: AgentRunState) => void;
}

export interface RunOptions {
  deckId: string;
  model?: string;
  signal?: AbortSignal;
}

/** 一次调用拿到完整初稿，套上主题后按真实测高排版，把体检结果交给用户 */
export async function runAgent(ctx: AgentContext, opts: RunOptions): Promise<void> {
  const { deckId, model, signal } = opts;
  const aborted = () => signal?.aborted ?? false;

  ctx.onState({ phase: 'drafting', note: '正在通读全文并生成初稿' });
  const proposal = await agentApi.draft(deckId, model, signal);
  if (aborted()) return;

  ctx.applyDraft(proposal);

  ctx.onState({ phase: 'measuring', note: '正在测量真实排版' });
  const report = await ctx.measure();
  if (aborted()) return;

  const healthy = !report.overflowPages.length && !report.thinPages.length;
  ctx.onState({
    phase: 'done',
    report,
    note: healthy ? '初稿排版已达标' : '初稿已生成，装不下和偏空的页请人工调整',
  });
}
