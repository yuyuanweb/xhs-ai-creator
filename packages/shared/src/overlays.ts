import type { PageOverlay } from './types/deck.js';

export function upgradeOverlays(raw: unknown): PageOverlay[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is PageOverlay => Boolean(o && typeof o === 'object' && typeof (o as PageOverlay).id === 'string'));
}
