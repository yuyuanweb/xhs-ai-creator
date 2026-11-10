import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck } from '@rcs/shared';
import { deckApi } from '../api/endpoints';

/** 人工改动不必每次敲键都打一次接口 */
const SAVE_DEBOUNCE = 800;

export type UpdateDeck = (updater: (prev: Deck) => Deck) => void;

/** pending：改了还没到落盘时间；saving：请求在路上 */
export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface DeckEditor {
  deck: Deck;
  saveState: SaveState;
  retrySave: () => void;
  updateDeck: UpdateDeck;
}

/** 编辑台的稿子状态：改动和落盘都走这里 */
export function useDeckEditor(initial: Deck): DeckEditor {
  const [deck, setDeck] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deckRef = useRef(deck);
  deckRef.current = deck;

  useEffect(() => {
    setDeck(initial);
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

  const updateDeck = useCallback<UpdateDeck>(
    (updater) => {
      setDeck((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  return { deck, saveState, retrySave, updateDeck };
}
