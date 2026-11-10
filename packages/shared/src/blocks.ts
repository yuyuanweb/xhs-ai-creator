import type { BlockEntry, CalloutTone, CardBlock, CardBlockKind, StepMarker } from './types/deck.js';
import { COMPONENT_KINDS } from './types/deck.js';
import { cleanBodyText } from './images.js';
import { normalizeQuotes } from './copy-style.js';

export const CARD_BLOCK_KINDS: CardBlockKind[] = ['h2', 'h3', 'p', 'ul', 'ol', 'image', 'code', 'quote', ...COMPONENT_KINDS];

const ENTRY_KINDS: CardBlockKind[] = ['steps', 'stats', 'cards', 'flow', 'chart'];
const TEXT_KINDS: CardBlockKind[] = ['p', 'quote', 'callout'];
const TONES: CalloutTone[] = ['accent', 'dark', 'warn'];
const MARKERS: StepMarker[] = ['number', 'arrow'];

/** 组件条目数的上限。再多一页就装不下，模型给多了直接截断，比让分页去硬塞好 */
const MAX_ENTRIES: Partial<Record<CardBlockKind, number>> = { steps: 6, stats: 4, cards: 6, flow: 5, chart: 6 };
const MAX_TABLE_ROWS = 8;
const MAX_TABLE_COLS = 4;
/** 流程图、条形图少于两项就画不成图 */
const MIN_DIAGRAM_ENTRIES = 2;

/**
 * 引题是写给读者看的内容，不是写给编辑看的版面标注。
 * 「开篇定调」「核心观点」「本节小结」这类说的是这一页在稿子里起什么作用，读者看了一头雾水
 */
const META_LABEL =
  /^(开篇|开场|开头|引言|引子|导语|导读|前言|序言|结语|结尾|收尾|尾声|总结|小结|回顾|核心|要点|重点|干货|概览|概述|速览|背景|正文|补充)(定调|观点|要点|总结|速览|一览|回顾|介绍|说明|部分|内容|信息)?$|^(本节|本章|本页|这一页|这一节|第.{1,3}(章|节|部分|页))/;

export function isMetaLabel(label: string): boolean {
  return META_LABEL.test(label.replace(/[\s·・|｜:：,，.。!！?？]/g, ''));
}

/**
 * 条形图的取值：value 里恰好有一个数字才能画成长短可比的条，「70–500ms」这种区间没法画。
 * 千分位逗号先去掉，免得「1,200」被拆成两个数
 */
export function chartValue(value: string | undefined): number | undefined {
  const nums = (value ?? '').replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g);
  return nums?.length === 1 ? Number(nums[0]) : undefined;
}

/**
 * 把模型给的块字段收拾干净：去掉不认识的枚举值、空条目、越界的高亮下标，表格补齐成矩形。
 * 初稿归一化和修版补丁共用这一处，两条路径产出的块长得一样。
 * 条形图里有画不出来的数字时整块退回大数字组件，kind 可能会变，调用方要以返回值的 kind 为准
 */
export function tidyBlock(raw: Partial<CardBlock>): Partial<CardBlock> {
  const { id: _id, rows, tone, marker, highlight, label, sources, ...rest } = raw;
  const out: Partial<CardBlock> = { ...rest };
  let kind = raw.kind;

  if (kind === 'h2' && Array.isArray(sources)) {
    const ids = sources.filter((s): s is string => typeof s === 'string' && /^s\d+$/.test(s));
    if (ids.length) out.sources = [...new Set(ids)];
  }

  if (kind && TEXT_KINDS.includes(kind) && typeof out.text === 'string') out.text = cleanBodyText(out.text);

  // 模型常把组件条目写进 items：对象就原样当条目，字符串当标题
  let entries = raw.entries;
  if (kind && ENTRY_KINDS.includes(kind) && !entries?.length && Array.isArray(raw.items)) {
    entries = (raw.items as unknown[]).map((it) => (typeof it === 'string' ? { title: it } : (it as BlockEntry)));
    delete out.items;
  }

  if (typeof label === 'string' && label.trim() && kind !== 'h2') out.label = label.trim();

  if (entries !== undefined) {
    let cleaned = entries.map(tidyEntry).filter((e): e is BlockEntry => e !== null);
    if (kind === 'chart' && cleaned.some((e) => chartValue(e.value) === undefined)) {
      kind = 'stats';
      out.kind = kind;
      cleaned = cleaned.filter((e) => e.value);
    }
    out.entries = cleaned.slice(0, (kind && MAX_ENTRIES[kind]) ?? 6);
  }

  if (rows !== undefined) {
    const cleaned = rows
      .filter(Array.isArray)
      .map((r) => r.slice(0, MAX_TABLE_COLS).map((c) => String(c ?? '').trim()))
      .filter((r) => r.some(Boolean))
      .slice(0, MAX_TABLE_ROWS);
    const width = Math.max(0, ...cleaned.map((r) => r.length));
    out.rows = cleaned.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
  }

  if (tone !== undefined && TONES.includes(tone)) out.tone = tone;
  if (marker !== undefined && MARKERS.includes(marker)) out.marker = marker;
  if (typeof highlight === 'number' && highlight >= 0 && highlight < (out.entries?.length ?? Infinity)) {
    out.highlight = Math.floor(highlight);
  }

  return kind === 'code' ? out : withNormalizedQuotes(out);
}

/** 卡片上印出来的字统一换成中文引号，code 块原样展示所以不碰 */
function withNormalizedQuotes(b: Partial<CardBlock>): Partial<CardBlock> {
  const q = (s: string | undefined) => (s === undefined ? s : normalizeQuotes(s));
  return {
    ...b,
    ...(b.text !== undefined && { text: q(b.text) }),
    ...(b.label !== undefined && { label: q(b.label) }),
    ...(b.items && { items: b.items.map(normalizeQuotes) }),
    ...(b.rows && { rows: b.rows.map((r) => r.map(normalizeQuotes)) }),
    ...(b.entries && {
      entries: b.entries.map((e) => ({
        ...e,
        ...(e.label !== undefined && { label: q(e.label) }),
        ...(e.title !== undefined && { title: q(e.title) }),
        ...(e.text !== undefined && { text: q(e.text) }),
      })),
    }),
  };
}

/**
 * 读出库里的块时过一遍清洗：老稿子里的出处小字、「图注留空」这类备注直接去掉，洗空的块整块丢掉；
 * 老稿子 h2 上方的引题也一并摘掉
 */
export function upgradeBlocks(raw: unknown): CardBlock[] {
  if (!Array.isArray(raw)) return [];
  return (raw as CardBlock[]).flatMap((b) => {
    if (b.kind === 'h2' && b.label !== undefined) {
      const { label: _label, ...rest } = b;
      return [rest];
    }
    if (!TEXT_KINDS.includes(b.kind) || typeof b.text !== 'string') return [b];
    const text = cleanBodyText(b.text);
    return text ? [{ ...b, text }] : [];
  });
}

/** 块里有没有能印出来的东西。空块进了分页只会占一个看不见的位置 */
export function hasContent(b: Partial<CardBlock>): boolean {
  switch (b.kind) {
    case 'image':
      return Boolean(b.imageId);
    case 'steps':
    case 'stats':
    case 'cards':
      return Boolean(b.entries?.length);
    case 'flow':
    case 'chart':
      return (b.entries?.length ?? 0) >= MIN_DIAGRAM_ENTRIES;
    case 'table':
      return (b.rows?.length ?? 0) >= 2;
    case 'ul':
    case 'ol':
      return Boolean(b.items?.length);
    case 'code':
      return Boolean(b.code);
    default:
      return Boolean(b.text?.trim());
  }
}

function tidyEntry(e: unknown): BlockEntry | null {
  if (!e || typeof e !== 'object') return null;
  const src = e as Record<string, unknown>;
  const out: BlockEntry = {};
  for (const key of ['label', 'title', 'value', 'text'] as const) {
    const v = src[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
    else if (typeof v === 'number') out[key] = String(v);
  }
  return Object.keys(out).length ? out : null;
}
