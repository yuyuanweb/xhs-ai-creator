import { useEffect } from 'react';
import { layoutKey, type Deck } from '@rcs/shared';
import { deckApi } from '../api/endpoints';
import type { DeckLayout } from '../layout/useDeckLayout';

/** 连续改字时只传最后一版 */
const UPLOAD_DEBOUNCE = 600;

/**
 * 测高落定后把体检结果交给服务端。测高只有浏览器能做，Cursor 里的模型要靠这份快照才知道哪几页装不下。
 * 传丢了不影响编辑，下次改动落定还会再传，所以失败不打扰用户
 */
export function useLayoutUpload(deck: Deck, layout: DeckLayout) {
  const { id, contentType, blocks, disabledBlockIds, settings } = deck;
  const { settled, snapshot } = layout;

  useEffect(() => {
    if (!settled || !blocks.length) return;
    const timer = setTimeout(() => {
      const key = layoutKey({ contentType, blocks, disabledBlockIds, settings });
      void deckApi.uploadLayout(id, { key, snapshot: snapshot() }).catch(() => undefined);
    }, UPLOAD_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [id, contentType, blocks, disabledBlockIds, settings, settled, snapshot]);
}
