import { useCallback, useEffect, useRef, useState } from 'react';
import { applyDraft, type AgentRunState, type Deck, type DraftProposal, type LayoutReport } from '@rcs/shared';
import type { UpdateDeck } from '../editor/useDeckEditor';
import type { DeckLayout } from '../layout/useDeckLayout';
import { runAgent, type AgentContext } from './runner';

/** 测高卡住时不能让生成一直等下去 */
const MEASURE_TIMEOUT = 15000;

const IDLE: AgentRunState = { phase: 'idle' };

export interface UseAgentResult {
  state: AgentRunState;
  running: boolean;
  start: (model?: string) => void;
  stop: () => void;
}

/**
 * 把 AI 生成接到 React 状态上。
 * 生成完要等浏览器真实测高，体检结果只有 DOM 能给。
 */
export function useAgent(
  deck: Deck | null,
  updateDeck: UpdateDeck,
  layout: DeckLayout,
): UseAgentResult {
  const [state, setState] = useState<AgentRunState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const userStop = useRef(false);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // 有改动待重新测量时才需要等；否则 measure() 可以立即拿当前结果返回
  const dirtyRef = useRef(false);
  const waiterRef = useRef<((r: LayoutReport) => void) | null>(null);

  useEffect(() => {
    if (!layout.settled || !waiterRef.current) return;
    const resolve = waiterRef.current;
    waiterRef.current = null;
    dirtyRef.current = false;
    resolve(layout.report);
  }, [layout.settled, layout.report]);

  const measure = useCallback((): Promise<LayoutReport> => {
    if (!dirtyRef.current && layoutRef.current.settled) {
      return Promise.resolve(layoutRef.current.report);
    }
    return new Promise<LayoutReport>((resolve) => {
      waiterRef.current = resolve;
      setTimeout(() => {
        if (waiterRef.current !== resolve) return;
        waiterRef.current = null;
        dirtyRef.current = false;
        resolve(layoutRef.current.report);
      }, MEASURE_TIMEOUT);
    });
  }, []);

  const start = useCallback(
    (model?: string) => {
      if (!deck) return;
      if (abortRef.current && !abortRef.current.signal.aborted) return;

      userStop.current = false;
      const controller = new AbortController();
      abortRef.current = controller;

      const ctx: AgentContext = {
        applyDraft: (proposal: DraftProposal) => {
          dirtyRef.current = true;
          updateDeck((prev) => applyDraft(prev, proposal));
        },
        measure,
        onState: setState,
      };

      runAgent(ctx, { deckId: deck.id, model, signal: controller.signal })
        .catch((err: Error) => {
          if (userStop.current) {
            setState((prev) => ({ ...prev, phase: 'done', note: '已手动停止' }));
            return;
          }
          if (controller.signal.aborted || err.name === 'AbortError' || err.message === '已取消') return;
          setState({ phase: 'failed', error: err.message });
        })
        .finally(() => {
          if (abortRef.current === controller) abortRef.current = null;
        });
    },
    [deck, updateDeck, measure],
  );

  const stop = useCallback(() => {
    userStop.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({ ...prev, phase: 'done', note: '已手动停止' }));
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { state, running: state.phase !== 'idle' && state.phase !== 'done' && state.phase !== 'failed', start, stop };
}
