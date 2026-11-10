import type { AiSnapshot, CardBlock, CoverSpec, Deck, OverlayKind, PageOverlay } from './types/deck.js';
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

export function defaultOverlay(partial: Omit<PageOverlay, 'id' | 'x' | 'y' | 'size'> & Partial<PageOverlay>): PageOverlay {
  return {
    id: newOverlayId(),
    x: 88,
    y: 10,
    size: 10,
    ...partial,
  };
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

export function upgradeAiSnapshot(raw: unknown): AiSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const snap = raw as AiSnapshot;
  if (!snap.cover || !Array.isArray(snap.blocks)) return undefined;
  return snap;
}

export function overlaysOnPage(overlays: PageOverlay[], pageIndex: number, pages: LayoutPage[]): PageOverlay[] {
  if (pageIndex === 0) return overlays.filter((o) => o.anchor === 'cover');
  const ids = new Set(pages[pageIndex - 1]?.blockIds ?? []);
  return overlays.filter((o) => o.anchor !== 'cover' && ids.has(o.anchor));
}

export function pruneOverlays(overlays: PageOverlay[], blocks: CardBlock[]): PageOverlay[] {
  const ids = new Set(blocks.map((b) => b.id));
  return overlays.filter((o) => o.anchor === 'cover' || ids.has(o.anchor));
}

/** 封面是 0，内容页从 1 起，和编辑台页码一致 */
export function dirtyPageIndexes(deck: Pick<Deck, 'cover' | 'blocks' | 'aiSnapshot'>, pages: LayoutPage[]): number[] {
  const snap = deck.aiSnapshot;
  if (!snap) return [];
  const dirty: number[] = [];
  if (coverFingerprint(deck.cover) !== coverFingerprint(snap.cover)) dirty.push(0);
  const prev = new Map(snap.blocks.map((b) => [b.id, b]));
  pages.forEach((page, i) => {
    const touched = page.blockIds.some((id) => {
      const cur = deck.blocks.find((b) => b.id === id);
      if (!cur) return false;
      if (cur.note?.trim()) return true;
      const old = prev.get(id);
      return !old || blockFingerprint(cur) !== blockFingerprint(old);
    });
    if (touched) dirty.push(i + 1);
  });
  return dirty;
}

export function takeAiSnapshot(cover: CoverSpec, blocks: CardBlock[]): AiSnapshot {
  return { cover, blocks };
}

/**
 * AI 修版、补章节之后，只把这一轮真改过的块写进快照。
 * 没动过的块保持原样，上面的人工修改仍然算人工改动。
 */
export function adoptAiEdits(prev: AiSnapshot | undefined, before: CardBlock[], after: CardBlock[]): AiSnapshot {
  const cover = prev?.cover ?? { title: '', variant: 'poster' };
  if (!prev) return takeAiSnapshot(cover, after);

  const beforeById = new Map(before.map((b) => [b.id, b]));
  const afterIds = new Set(after.map((b) => b.id));
  const replaced: string[] = [];
  const adopted: CardBlock[] = [];
  for (const block of after) {
    const old = beforeById.get(block.id);
    if (!old || blockFingerprint(block) !== blockFingerprint(old)) {
      replaced.push(block.id);
      adopted.push(block);
    }
  }
  for (const block of before) {
    if (!afterIds.has(block.id)) replaced.push(block.id);
  }
  if (!replaced.length) return prev;
  return mergeAiSnapshot(prev, { blocks: adopted }, replaced, false);
}

/** AI 改了封面文案时，封面也换成这一版，避免重新生成时把封面标成人工改过 */
export function adoptAiCover(prev: AiSnapshot | undefined, cover: CoverSpec, blocks: CardBlock[]): AiSnapshot {
  if (!prev) return takeAiSnapshot(cover, blocks);
  if (coverFingerprint(cover) === coverFingerprint(prev.cover)) return prev;
  return { ...prev, cover };
}

/** 只把这一次 AI 改过的封面 / 块写进快照，没动的页仍按上一份算人工改动 */
export function mergeAiSnapshot(
  prev: AiSnapshot | undefined,
  next: { cover?: CoverSpec; blocks: CardBlock[] },
  replacedIds: Iterable<string>,
  coverReplaced: boolean,
): AiSnapshot {
  const drop = new Set(replacedIds);
  const kept = (prev?.blocks ?? []).filter((b) => !drop.has(b.id));
  return {
    cover: coverReplaced && next.cover ? next.cover : (prev?.cover ?? next.cover ?? { title: '', variant: 'poster' }),
    blocks: [...kept, ...next.blocks],
  };
}

export function replacePageBlocks(
  blocks: CardBlock[],
  groups: Array<{ removeIds: string[]; insert: CardBlock[] }>,
): CardBlock[] {
  if (!groups.length) return blocks;
  const insertAt = new Map<string, CardBlock[]>();
  const drop = new Set<string>();
  for (const g of groups) {
    if (!g.removeIds.length) continue;
    g.removeIds.forEach((id) => drop.add(id));
    insertAt.set(g.removeIds[0]!, g.insert);
  }
  const out: CardBlock[] = [];
  for (const b of blocks) {
    const extra = insertAt.get(b.id);
    if (extra) {
      out.push(...extra);
      insertAt.delete(b.id);
      continue;
    }
    if (!drop.has(b.id)) out.push(b);
  }
  for (const extra of insertAt.values()) out.push(...extra);
  return out;
}

function resolveAnchor(at: unknown, blocks: CardBlock[]): string | undefined {
  if (typeof at !== 'string' || !at.trim()) return undefined;
  if (at === 'cover') return 'cover';
  if (blocks.some((b) => b.id === at)) return at;
  const h2 = blocks.find((b) => b.kind === 'h2' && b.sources?.includes(at));
  return h2?.id;
}

function blockFingerprint(b: CardBlock): string {
  const { note: _note, ...rest } = b;
  return JSON.stringify(rest);
}

function coverFingerprint(c: CoverSpec): string {
  return JSON.stringify(c);
}

function clampPct(n: unknown, fallback: number): number {
  return clamp(typeof n === 'number' && Number.isFinite(n) ? n : fallback, 2, 98);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
