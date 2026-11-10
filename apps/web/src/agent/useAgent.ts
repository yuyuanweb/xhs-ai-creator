import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_AGENT_ROUNDS,
  applyDraft,
  applyPatches,
  clampSettings,
  type AgentRunState,
  type ArticleIndex,
  type CoverSpec,
  type Deck,
  type DeckSettings,
  type DraftProposal,
  type LayoutSnapshot,
  type ReviseBlocksArgs,
} from '@rcs/shared';
import type { UpdateDeck } from '../editor/useDeckEditor';
import type { DeckLayout } from '../layout/useDeckLayout';
import { runAgent, type AgentContext, type DeckCheckpoint } from './runner';

/** 测高卡住时不能让整个循环无限等下去 */
const MEASURE_TIMEOUT = 15000;

const IDLE: AgentRunState = { phase: 'idle', round: 0, maxRounds: MAX_AGENT_ROUNDS };

export interface UseAgentResult {
  state: AgentRunState;
  running: boolean;
  start: (model?: string) => void;
  stop: () => void;
}

/**
 * 把 Agent 循环接到 React 状态上。
 * 循环跑在浏览器里，因为它唯一有价值的反馈——真实测高——只有 DOM 能给。
 */
export function useAgent(
  deck: Deck | null,
  updateDeck: UpdateDeck,
  layout: DeckLayout,
  source: ArticleIndex,
): UseAgentResult {
  const [state, setState] = useState<AgentRunState>(IDLE);
  const abortRef = useRef<AbortController | null>(null);
  const userStop = useRef(false);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // 有改动待重新测量时才需要等；否则 measure() 可以立即拿当前结果返回
  const dirtyRef = useRef(false);
  const waiterRef = useRef<((s: LayoutSnapshot) => void) | null>(null);

  useEffect(() => {
    if (!layout.settled || !waiterRef.current) return;
    const resolve = waiterRef.current;
    waiterRef.current = null;
    dirtyRef.current = false;
    resolve(layout.snapshot());
  }, [layout.settled, layout.snapshot]);

  const measure = useCallback((): Promise<LayoutSnapshot> => {
    if (!dirtyRef.current && layoutRef.current.settled) {
      return Promise.resolve(layoutRef.current.snapshot());
    }
    return new Promise<LayoutSnapshot>((resolve) => {
      waiterRef.current = resolve;
      setTimeout(() => {
        if (waiterRef.current !== resolve) return;
        waiterRef.current = null;
        dirtyRef.current = false;
        resolve(layoutRef.current.snapshot());
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
        checkpoint: () => {
          const { blocks, cover, settings } = deckRef.current!;
          return { blocks, cover, settings };
        },
        restore: (cp: DeckCheckpoint) => {
          dirtyRef.current = true;
          updateDeck((prev) => ({ ...prev, ...cp }));
        },
        applyPatches: (args: ReviseBlocksArgs) => {
          dirtyRef.current = true;
          let outcome = { applied: 0, skipped: [] as string[] };
          updateDeck((prev) => {
            const res = applyPatches(prev.blocks, args.patches ?? [], sourceRef.current);
            outcome = { applied: res.applied, skipped: res.skipped };
            return { ...prev, blocks: res.blocks };
          });
          return outcome;
        },
        applyCover: (cover: Partial<CoverSpec>) => {
          updateDeck((prev) => ({ ...prev, cover: { ...prev.cover, ...cover } }));
        },
        applySettings: (settings: Partial<DeckSettings>) => {
          dirtyRef.current = true;
          updateDeck((prev) => ({ ...prev, settings: clampSettings({ ...prev.settings, ...settings }) }));
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
          setState({ phase: 'failed', round: 0, maxRounds: MAX_AGENT_ROUNDS, error: err.message });
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
