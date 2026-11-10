import type { PageOverlay } from './types/deck.js';
import type { LayoutPage } from './types/layout.js';

export interface DecorItem {
  id: string;
  emoji?: string;
  label: string;
  path?: string;
}

/** 线稿小图标，印在卡片上比表情更克制 */
export const DECOR_ICONS: DecorItem[] = [
  { id: 'star', label: '星星', path: 'M12 3l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 15.8 7 18.4l1.1-5.6L4 8.9l5.6-.7z' },
  { id: 'check', label: '勾', path: 'M5 12.5l4.2 4.2L19 7' },
  { id: 'bolt', label: '闪电', path: 'M13 3L6 13h6l-1 8 7-10h-6z' },
  { id: 'arrow', label: '箭头', path: 'M5 12h12m0 0l-5-5m5 5l-5 5' },
  { id: 'warn', label: '警示', path: 'M12 5l8 14H4zM12 10v4M12 16.5v.5' },
  { id: 'dot', label: '圆点', path: 'M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'quote', label: '引号', path: 'M7 8h4v6H8a3 3 0 01-3-3V8h2zm8 0h4v6h-3a3 3 0 01-3-3V8h2z' },
  { id: 'plus', label: '加号', path: 'M12 6v12M6 12h12' },
];

export function upgradeOverlays(raw: unknown): PageOverlay[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is PageOverlay => Boolean(o && typeof o === 'object' && typeof (o as PageOverlay).id === 'string'));
}

export function overlaysOnPage(overlays: PageOverlay[], pageIndex: number, pages: LayoutPage[]): PageOverlay[] {
  if (pageIndex === 0) return overlays.filter((o) => o.anchor === 'cover');
  const ids = new Set(pages[pageIndex - 1]?.blockIds ?? []);
  return overlays.filter((o) => o.anchor !== 'cover' && ids.has(o.anchor));
}
