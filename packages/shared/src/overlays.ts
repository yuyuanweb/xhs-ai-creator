import type { CardBlock, OverlayKind, PageOverlay } from './types/deck.js';
import type { LayoutPage } from './types/layout.js';

const MAX_OVERLAYS = 24;
const KINDS: OverlayKind[] = ['emoji', 'icon', 'image'];

export interface DecorItem {
  id: string;
  emoji?: string;
  label: string;
  path?: string;
}

/** 卡片角落常用的小表情。正文句子里不要堆这些，只当浮动装饰 */
export const DECOR_EMOJIS: DecorItem[] = [
  { id: 'idea', emoji: '💡', label: '灵感' },
  { id: 'fire', emoji: '🔥', label: '热门' },
  { id: 'ok', emoji: '✅', label: '通过' },
  { id: 'warn', emoji: '⚠️', label: '注意' },
  { id: 'star', emoji: '⭐', label: '重点' },
  { id: 'pin', emoji: '📌', label: '钉住' },
  { id: 'target', emoji: '🎯', label: '目标' },
  { id: 'rocket', emoji: '🚀', label: '加速' },
  { id: 'spark', emoji: '✨', label: '亮点' },
  { id: 'think', emoji: '🤔', label: '思考' },
  { id: 'clap', emoji: '👏', label: '好评' },
  { id: 'down', emoji: '⬇️', label: '往下' },
  { id: 'right', emoji: '➡️', label: '下一步' },
  { id: 'money', emoji: '💰', label: '成本' },
  { id: 'chart', emoji: '📊', label: '数据' },
  { id: 'tool', emoji: '🛠️', label: '工具' },
  { id: 'lock', emoji: '🔒', label: '限制' },
  { id: 'key', emoji: '🔑', label: '关键' },
  { id: 'time', emoji: '⏱️', label: '耗时' },
  { id: 'new', emoji: '🆕', label: '上新' },
];

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

export function findDecor(kind: OverlayKind, id: string | undefined): DecorItem | undefined {
  if (!id) return undefined;
  return kind === 'icon' ? DECOR_ICONS.find((i) => i.id === id) : DECOR_EMOJIS.find((i) => i.id === id || i.emoji === id);
}

export function newOverlayId(): string {
  return `ov${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 模型给的装饰：at 可以是 cover、原文章节号 s3，或已经落库的块 id。
 * 章节号落到认领它的那个 h2 上，分页变了装饰还跟着那一章。
 */
export function normalizeOverlays(raw: unknown, blocks: CardBlock[]): PageOverlay[] {
  if (!Array.isArray(raw)) return [];
  const out: PageOverlay[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Record<string, unknown>;
    const kind = KINDS.includes(src.kind as OverlayKind) ? (src.kind as OverlayKind) : 'emoji';
    const anchor = resolveAnchor(typeof src.at === 'string' ? src.at : src.anchor, blocks);
    if (!anchor) continue;
    if (kind === 'emoji' && !String(src.emoji ?? '').trim()) continue;
    if (kind === 'icon' && !findDecor('icon', String(src.icon ?? ''))) continue;
    if (kind === 'image' && !String(src.imageId ?? '').trim()) continue;
    out.push({
      id: typeof src.id === 'string' && src.id.trim() ? src.id.trim() : newOverlayId(),
      anchor,
      kind,
      ...(kind === 'emoji' && { emoji: String(src.emoji).trim() }),
      ...(kind === 'icon' && { icon: String(src.icon).trim() }),
      ...(kind === 'image' && { imageId: String(src.imageId).trim() }),
      x: clampPct(src.x, 88),
      y: clampPct(src.y, 10),
      size: clamp(Number(src.size) || 10, 6, 28),
      ...(typeof src.rotate === 'number' && Number.isFinite(src.rotate) ? { rotate: src.rotate } : {}),
    });
    if (out.length >= MAX_OVERLAYS) break;
  }
  return out;
}

export function upgradeOverlays(raw: unknown): PageOverlay[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is PageOverlay => Boolean(o && typeof o === 'object' && typeof (o as PageOverlay).id === 'string'));
}

export function overlaysOnPage(overlays: PageOverlay[], pageIndex: number, pages: LayoutPage[]): PageOverlay[] {
  if (pageIndex === 0) return overlays.filter((o) => o.anchor === 'cover');
  const ids = new Set(pages[pageIndex - 1]?.blockIds ?? []);
  return overlays.filter((o) => o.anchor !== 'cover' && ids.has(o.anchor));
}

function resolveAnchor(at: unknown, blocks: CardBlock[]): string | undefined {
  if (typeof at !== 'string' || !at.trim()) return undefined;
  if (at === 'cover') return 'cover';
  if (blocks.some((b) => b.id === at)) return at;
  const h2 = blocks.find((b) => b.kind === 'h2' && b.sources?.includes(at));
  return h2?.id;
}

function clampPct(n: unknown, fallback: number): number {
  return clamp(typeof n === 'number' && Number.isFinite(n) ? n : fallback, 2, 98);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
