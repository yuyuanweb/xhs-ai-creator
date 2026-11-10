import type { Deck } from '@rcs/shared';

/** 能撤销的那几项。id、时间戳跟着当前稿走，不进历史 */
export type DeckSnapshot = Pick<
  Deck,
  'contentType' | 'blocks' | 'cover' | 'settings' | 'disabledBlockIds' | 'overlays' | 'aiSnapshot' | 'status'
>;

export const MAX_HISTORY = 80;
/** 拖字号这类连续改动并成一步，否则滑一下就要撤几十次 */
export const COALESCE_MS = 500;

export function snapshotOf(deck: Deck): DeckSnapshot {
  return {
    contentType: deck.contentType,
    blocks: deck.blocks,
    cover: deck.cover,
    settings: deck.settings,
    disabledBlockIds: deck.disabledBlockIds,
    overlays: deck.overlays,
    aiSnapshot: deck.aiSnapshot,
    status: deck.status,
  };
}

export function applySnapshot(deck: Deck, snap: DeckSnapshot): Deck {
  return { ...deck, ...snap };
}

export function sameSnapshot(a: DeckSnapshot, b: DeckSnapshot): boolean {
  return (
    a.contentType === b.contentType &&
    a.status === b.status &&
    a.blocks === b.blocks &&
    a.cover === b.cover &&
    a.settings === b.settings &&
    a.disabledBlockIds === b.disabledBlockIds &&
    a.overlays === b.overlays &&
    a.aiSnapshot === b.aiSnapshot
  );
}

/** 只动了样式或封面，没改块流。这种改动连着发生时并成一步 */
export function isMetaOnly(prev: DeckSnapshot, next: DeckSnapshot): boolean {
  return (
    prev.blocks === next.blocks &&
    prev.disabledBlockIds === next.disabledBlockIds &&
    prev.contentType === next.contentType &&
    prev.status === next.status
  );
}
