import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck } from '@rcs/shared';
import { deckApi } from '../api/endpoints';
import {
  COALESCE_MS,
  MAX_HISTORY,
  applySnapshot,
  isMetaOnly,
  sameSnapshot,
  snapshotOf,
  type DeckSnapshot,
} from './history';

/** 人工改动不必每次敲键都打一次接口 */
const SAVE_DEBOUNCE = 800;

export type UpdateDeck = (updater: (prev: Deck) => Deck, opts?: { history?: boolean }) => void;

export interface DeckHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/** pending：改了还没到落盘时间；saving：请求在路上 */
export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface DeckEditor extends DeckHistory {
  deck: Deck;
  saveState: SaveState;
  retrySave: () => void;
  updateDeck: UpdateDeck;
}

/**
 * 编辑台的稿子状态：改动、落盘、撤销重做都走这里。
 * Agent 一轮里的中间态用 history: false，整次生成只占历史里的一步。
 */
export function useDeckEditor(initial: Deck): DeckEditor {
  const [deck, setDeck] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const past = useRef<DeckSnapshot[]>([]);
  const future = useRef<DeckSnapshot[]>([]);
  const lastPush = useRef<{ at: number; meta: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deckRef = useRef(deck);
  deckRef.current = deck;

  // 换了一篇稿，旧的撤销栈不能跟着用
  useEffect(() => {
    setDeck(initial);
    past.current = [];
    future.current = [];
    lastPush.current = null;
    setCanUndo(false);
    setCanRedo(false);
  }, [initial.id]);

  const persist = useCallback((next: Deck) => {
    clearTimeout(saveTimer.current);
    // persist 会在 setDeck 的 updater 里被调用，状态更新挪出渲染阶段
    queueMicrotask(() => setSaveState('pending'));
    saveTimer.current = setTimeout(() => {
      setSaveState('saving');
      void deckApi
        .update(next.id, {
          contentType: next.contentType,
          blocks: next.blocks,
          cover: next.cover,
          settings: next.settings,
          disabledBlockIds: next.disabledBlockIds,
          overlays: next.overlays,
          aiSnapshot: next.aiSnapshot ?? null,
          status: next.status,
        })
        // 落盘期间又改了的话，状态已经被新的一轮置成 pending，不能被这一轮的结果盖掉
        .then(() => setSaveState((s) => (s === 'saving' ? 'saved' : s)))
        .catch(() => setSaveState((s) => (s === 'saving' ? 'error' : s)));
    }, SAVE_DEBOUNCE);
  }, []);

  const retrySave = useCallback(() => persist(deckRef.current), [persist]);

  // 还有没落盘的改动时关页面，浏览器给一次挽留
  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const commit = useCallback(
    (prev: Deck, next: Deck, record: boolean) => {
      if (next === prev || sameSnapshot(prev, next)) return prev;

      if (record) {
        const meta = isMetaOnly(prev, next);
        const coalesce =
          meta && lastPush.current?.meta && Date.now() - lastPush.current.at < COALESCE_MS && past.current.length > 0;
        if (!coalesce) {
          past.current = [...past.current, snapshotOf(prev)].slice(-MAX_HISTORY);
        }
        future.current = [];
        lastPush.current = { at: Date.now(), meta };
        setCanUndo(true);
        setCanRedo(false);
      }

      persist(next);
      return next;
    },
    [persist],
  );

  const updateDeck = useCallback<UpdateDeck>(
    (updater, opts) => {
      setDeck((prev) => commit(prev, updater(prev), opts?.history !== false));
    },
    [commit],
  );

  const undo = useCallback(() => {
    const snap = past.current[past.current.length - 1];
    if (!snap) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, snapshotOf(deckRef.current)];
    lastPush.current = null;
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    setDeck((prev) => {
      const next = applySnapshot(prev, snap);
      persist(next);
      return next;
    });
  }, [persist]);

  const redo = useCallback(() => {
    const snap = future.current[future.current.length - 1];
    if (!snap) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, snapshotOf(deckRef.current)];
    lastPush.current = null;
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
    setDeck((prev) => {
      const next = applySnapshot(prev, snap);
      persist(next);
      return next;
    });
  }, [persist]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return { deck, saveState, retrySave, updateDeck, canUndo, canRedo, undo, redo };
}
