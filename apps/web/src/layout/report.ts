import {
  CONTENT_H,
  CONTENT_W,
  MIN_FILL,
  TARGET_CARDS,
  TARGET_IMAGES,
  XHS,
  isShot,
  type ArticleIndex,
  type CardBlock,
  type ContentType,
  type DeckSettings,
  type LayoutPage,
  type LayoutReport,
  type LayoutSnapshot,
} from '@rcs/shared';
import { plainText } from '../render/inline';

export interface ImageUsage {
  used: number;
  /** 能用却没用上的原文截图，按原文顺序，带上它在原文里所属的节 */
  unused: LayoutSnapshot['unusedImages'];
}

export function imageUsage(blocks: CardBlock[], source: ArticleIndex): ImageUsage {
  const picked = new Set(blocks.flatMap((b) => (b.kind === 'image' && b.imageId ? [b.imageId] : [])));
  const usable = [...source.images.values()].filter(isShot);
  return {
    used: usable.filter((img) => picked.has(img.id)).length,
    unused: usable
      .filter((img) => !picked.has(img.id))
      .map((img) => ({ id: img.id, source: source.imageUnits.get(img.id) ?? '' })),
  };
}

export function buildReport(pages: LayoutPage[], contentType: ContentType, images: ImageUsage): LayoutReport {
  const fills = pages.map((p) => Number(p.fill.toFixed(3)));
  // 封面也占一张，发布时一起算进平台上限
  const totalCards = pages.length + 1;
  const limits = TARGET_CARDS[contentType];

  return {
    totalCards,
    contentPages: pages.length,
    overflowPages: pages.filter((p) => p.overflow).map((p) => p.index),
    thinPages: pages.filter((p) => p.fill < MIN_FILL).map((p) => p.index),
    avgFill: fills.length ? Number((fills.reduce((a, b) => a + b, 0) / fills.length).toFixed(3)) : 0,
    fills,
    exceedsPlatformLimit: totalCards > XHS.MAX_IMAGES,
    withinTarget: totalCards >= limits.min && totalCards <= limits.max,
    imagesUsed: images.used,
    imagesMin: Math.min(TARGET_IMAGES[contentType].min, images.used + images.unused.length),
    imagesMax: TARGET_IMAGES[contentType].max,
  };
}

/** 给 Agent 看的快照。没有每页摘要，模型就算知道第三页有问题也不知道第三页在讲什么 */
export function buildSnapshot(
  pages: LayoutPage[],
  blocks: CardBlock[],
  contentType: ContentType,
  settings: DeckSettings,
  images: ImageUsage,
): LayoutSnapshot {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const report = buildReport(pages, contentType, images);
  const canAddImage = images.unused.length > 0 && report.imagesUsed < report.imagesMax;

  return {
    report,
    pages: pages.map((p) => {
      const advice = thinAdvice(p, blocks, byId, settings.fontSize, canAddImage);
      return {
        index: p.index,
        fill: Number(p.fill.toFixed(2)),
        overflow: p.overflow,
        blocks: p.blockIds.flatMap((id) => {
          const b = byId.get(id);
          if (!b) return [];
          return [{ id, kind: b.kind, text: summaryOf(b), ...(b.sources?.length ? { sources: b.sources } : {}) }];
        }),
        ...(advice ? { advice } : {}),
      };
    }),
    unusedImages: images.unused,
  };
}

/** 与 card.css 里正文的 line-height 保持一致 */
const BODY_LINE_H = 1.62;
/** 补到比及格线再高一点，免得改完刚好卡线 */
const FILL_GOAL = MIN_FILL + 0.08;

/**
 * 能和邻页并掉的空页分页阶段已经自动并了，走到体检还偏空的只剩扩写一条路。
 * 把「补多少、补在哪」算好交给模型，它自己估字数往往差一倍。
 */
function thinAdvice(
  page: LayoutPage,
  order: CardBlock[],
  byId: Map<string, CardBlock>,
  fontSize: number,
  canAddImage: boolean,
): string | undefined {
  if (page.fill >= MIN_FILL || page.overflow) return undefined;

  const lines = Math.ceil(((FILL_GOAL - page.fill) * CONTENT_H) / (fontSize * BODY_LINE_H));
  const chars = lines * Math.floor(CONTENT_W / fontSize);
  const pageBlocks = page.blockIds.map((id) => byId.get(id)).filter((b): b is CardBlock => Boolean(b));
  const target = [...pageBlocks].reverse().find((b) => b.kind === 'p');
  const rule = '只用原文里这一节写到的做法、数字和细节，原文没有的一个都不能编，也不要重复已有段落';
  // 截图最撑版面，而且不用编字。只有本页没图、全篇也还没到上限时才提，一页塞两张大图会溢出
  const shot =
    canAddImage && !pageBlocks.some((b) => b.kind === 'image')
      ? 'unusedImages 里如果有原文就排在这一节、前后文讲清了画面的截图，优先 insert 一张到本页介绍它的段落后面，截图会自动放大填满余量；'
      : '';

  // 续页是上一页那一章装不下挤出来的尾巴。扩写只会让这一章更长，该做的是把整章删短收回一页
  if (page.continued && page.chapter !== undefined) {
    const spill = Math.ceil((page.fill * CONTENT_H) / (fontSize * BODY_LINE_H));
    return `本页是 §${page.chapter} 在上一页放不下挤出来的续页，只有约 ${spill} 行。把 §${page.chapter} 的段落删到一两句、组件条目删短，腾出约 ${spill} 行，让 ${page.blockIds.join('、')} 回到上一页；原文这一章内容确实很多，才给本页补一个组件写成完整一页。${rule}`;
  }

  if (target) {
    return `本页还差约 ${lines} 行（${chars} 字）。${shot}其次在本页 insert 一个组件放原文这一节还没用上的内容；实在没有，就 replace 本页的段落 ${target.id}，保留原意再往下展开。${rule}`;
  }
  const first = pageBlocks[0];
  const before = first ? order[order.findIndex((b) => b.id === first.id) - 1] : undefined;
  const where = before ? `insert 一个 p，blockId 填 ${before.id}（新段落会排在 ${first!.id} 前面）` : 'insert 一个 p';
  return `本页没有段落可扩。${shot}否则 ${where}，约 ${chars} 字，讲这一节原文里还没用上的内容。${rule}；不要写「这是 xx 截图 / 主视图」这类描述图片的话。原文这一节已经没有可用内容时就不要硬补`;
}

const SUMMARY_LEN = 40;

function summaryOf(b: CardBlock): string {
  if (b.kind === 'image') return b.text ? `[图] ${plainText(b.text)}` : '[图]';
  if (b.kind === 'code') return '[代码]';
  const plain = plainText(textOf(b));
  return plain.length > SUMMARY_LEN ? `${plain.slice(0, SUMMARY_LEN)}…` : plain;
}

function textOf(b: CardBlock): string {
  switch (b.kind) {
    case 'ul':
    case 'ol':
      return (b.items ?? []).join(' / ');
    case 'steps':
    case 'stats':
    case 'cards':
    case 'flow':
      return `[${b.entries?.length ?? 0} 项] ${(b.entries ?? []).map((e) => e.title ?? e.value ?? e.label ?? '').join(' / ')}`;
    case 'chart':
      return `[${b.entries?.length ?? 0} 条] ${(b.entries ?? []).map((e) => `${e.label ?? ''} ${e.value ?? ''}`.trim()).join(' / ')}`;
    case 'table':
      return `[${b.rows?.length ?? 0} 行] ${(b.rows?.[0] ?? []).join(' / ')}`;
    case 'callout':
      return `[${b.tone ?? 'accent'}] ${b.text ?? ''}`;
    default:
      return b.text ?? '';
  }
}
