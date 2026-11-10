import {
  MAX_AGENT_ROUNDS,
  isRevisionDone,
  layoutScore,
  layoutTodo,
  type AdjustSettingsArgs,
  type AgentMessage,
  type AgentRunState,
  type AgentToolCall,
  type CoverSpec,
  type Deck,
  type DeckSettings,
  type DraftProposal,
  type LayoutSnapshot,
  type ReviseBlocksArgs,
  type ReviseCoverArgs,
} from '@rcs/shared';
import { agentApi } from '../api/endpoints';
import { nextShotPatch } from './auto-shots';

const STALE_ROUNDS = 2;

/**
 * Agent 与卡片稿之间的全部接触面。
 * 循环本身不碰 React，所有状态改动都通过这几个回调交出去。
 */
export type DeckCheckpoint = Pick<Deck, 'blocks' | 'cover' | 'settings'>;

export interface AgentContext {
  applyDraft: (proposal: DraftProposal) => void;
  /** 修版可能越改越差，循环结束时要能退回得分最好的那一版 */
  checkpoint: () => DeckCheckpoint;
  restore: (cp: DeckCheckpoint) => void;
  applyPatches: (args: ReviseBlocksArgs) => { applied: number; skipped: string[] };
  applyCover: (cover: Partial<CoverSpec>) => void;
  applySettings: (settings: Partial<DeckSettings>) => void;
  /** 等重新测高和分页落定后返回真实排版结果 */
  measure: () => Promise<LayoutSnapshot>;
  onState: (state: AgentRunState) => void;
}

export interface RunOptions {
  deckId: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * 先出初稿，再按真实测高迭代。每一轮都要真的改好，分数没降就停，不空转。
 */
export async function runAgent(ctx: AgentContext, opts: RunOptions): Promise<void> {
  const { deckId, model, signal } = opts;
  const aborted = () => signal?.aborted ?? false;

  ctx.onState({ phase: 'drafting', round: 0, maxRounds: MAX_AGENT_ROUNDS, note: '正在通读全文并生成初稿' });
  const proposal = await agentApi.draft(deckId, model, signal);
  if (aborted()) return;

  ctx.applyDraft(proposal);

  ctx.onState({ phase: 'measuring', round: 0, maxRounds: MAX_AGENT_ROUNDS, note: '正在测量真实排版' });
  let snapshot = await fillWithShots(ctx, await ctx.measure(), aborted);
  if (aborted()) return;

  const done = () => isRevisionDone(snapshot, ctx.checkpoint().blocks);
  const todo = () => layoutTodo(snapshot, ctx.checkpoint().blocks);

  if (done()) {
    ctx.onState({
      phase: 'done',
      round: 0,
      maxRounds: MAX_AGENT_ROUNDS,
      report: snapshot.report,
      note: '初稿排版已达标，无需迭代',
    });
    return;
  }

  const messages: AgentMessage[] = [
    { role: 'assistant', content: JSON.stringify({ contentType: proposal.contentType, targetCards: proposal.targetCards }) },
    {
      role: 'user',
      content: `这是刚才那份初稿的真实排版体检结果：\n${JSON.stringify(snapshot)}\n\n这一轮要做：\n${todo()}\n一次改到位，然后 measure_layout 或 finish。`,
    },
  ];

  let best = { score: layoutScore(snapshot.report), checkpoint: ctx.checkpoint() };
  let stale = 0;

  const settle = async (round: number, note: string) => {
    if (layoutScore(snapshot.report) > best.score) {
      ctx.restore(best.checkpoint);
      snapshot = await ctx.measure();
      note = `${note}；最后几轮越改越差，已退回最好的一版`;
    }
    // 修版可能又挤出了新的空页，收尾前再补一遍截图
    snapshot = await fillWithShots(ctx, snapshot, aborted);
    ctx.onState({ phase: 'done', round, maxRounds: MAX_AGENT_ROUNDS, report: snapshot.report, note });
  };

  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    if (aborted()) return;

    ctx.onState({
      phase: 'revising',
      round,
      maxRounds: MAX_AGENT_ROUNDS,
      report: snapshot.report,
      note: `第 ${round} 轮修订`,
    });

    const res = await agentApi.step(deckId, messages, model, signal);
    if (aborted()) return;

    const calls = res.message.toolCalls ?? [];
    messages.push(res.message);

    if (!calls.length) break;

    let finished = false;
    for (const call of calls) {
      const { result, done } = await executeTool(call, ctx, () => snapshot);
      if (call.name === 'measure_layout' || call.name === 'revise_blocks' || call.name === 'adjust_settings') {
        snapshot = await ctx.measure();
      }
      finished ||= done;
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        content: JSON.stringify(
          call.name === 'finish'
            ? result
            : { ...(result as Record<string, unknown>), report: snapshot.report },
        ),
      });
    }

    // 容忍一轮没进步：合并页常常要先拆再并，头一轮分数反而会变差
    const score = layoutScore(snapshot.report);
    const improved = score < best.score;
    if (improved) {
      best = { score, checkpoint: ctx.checkpoint() };
      stale = 0;
    }
    if (done()) return settle(round, '排版指标和文案检查已全部达标');
    if (finished) return settle(round, '模型判断已改不动，结束迭代');
    if (improved) continue;
    if (++stale >= STALE_ROUNDS) return settle(round, `连续 ${STALE_ROUNDS} 轮没有更好，停止迭代`);
    messages.push({
      role: 'user',
      content: `这一轮排版没有变好：${JSON.stringify(snapshot.report)}。换个办法再做一次：\n${todo()}\n内容只从原文这一节里找，不许编原文没有的数据；不要改标题、不要跨章节挪块。`,
    });
  }

  await settle(MAX_AGENT_ROUNDS, '已达迭代上限，剩余问题请人工调整');
}

/** 自动补图最多试几次，每试一次都要重新测一次高 */
const MAX_AUTO_SHOT_TRIES = 8;

/**
 * 偏空又没图的页，先由代码从这一章的原文截图里补一张，每补一张都实测：分数没变好就退回、换下一张。
 * 不指望模型去补：它常常宁可扩写一段空话，或者干脆什么都不改
 */
async function fillWithShots(ctx: AgentContext, snapshot: LayoutSnapshot, aborted: () => boolean): Promise<LayoutSnapshot> {
  const skip = new Set<string>();
  let current = snapshot;

  for (let tries = 0; tries < MAX_AUTO_SHOT_TRIES && !aborted(); tries++) {
    const next = nextShotPatch(current, skip);
    if (!next) break;
    skip.add(next.key);

    const before = ctx.checkpoint();
    const { applied } = ctx.applyPatches({ patches: [next.patch], reason: '偏空页补截图' });
    if (!applied) continue;

    const measured = await ctx.measure();
    if (layoutScore(measured.report) < layoutScore(current.report)) {
      current = measured;
      continue;
    }
    ctx.restore(before);
    current = await ctx.measure();
  }
  return current;
}

async function executeTool(
  call: AgentToolCall,
  ctx: AgentContext,
  currentSnapshot: () => LayoutSnapshot,
): Promise<{ result: unknown; done: boolean }> {
  if (call.parseError) {
    return {
      result: {
        ok: false,
        error: `参数不是完整的 JSON（${call.parseError}），这次调用没有生效。多半是一次写得太长被截断了：一次最多提交 4 个补丁，分几次调用。`,
      },
      done: false,
    };
  }

  switch (call.name) {
    case 'measure_layout':
      return { result: currentSnapshot(), done: false };

    case 'revise_blocks': {
      const args = call.args as ReviseBlocksArgs;
      return { result: ctx.applyPatches(args), done: false };
    }

    case 'revise_cover': {
      const args = call.args as ReviseCoverArgs;
      ctx.applyCover(args.cover ?? {});
      return { result: { ok: true }, done: false };
    }

    case 'adjust_settings': {
      const { reason: _reason, ...rest } = call.args as AdjustSettingsArgs;
      ctx.applySettings(rest);
      return { result: { ok: true }, done: false };
    }

    case 'finish':
      return { result: { ok: true }, done: true };

    default:
      return { result: { ok: false, error: `不支持的工具 ${String(call.name)}` }, done: false };
  }
}
