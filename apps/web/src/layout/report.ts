import {
  MIN_FILL,
  TARGET_CARDS,
  TARGET_IMAGES,
  XHS,
  isShot,
  type ArticleIndex,
  type CardBlock,
  type ContentType,
  type LayoutPage,
  type LayoutReport,
} from '@rcs/shared';

export interface ImageUsage {
  used: number;
  /** 能用却没用上的原文截图，按原文顺序，带上它在原文里所属的节 */
  unused: Array<{ id: string; source: string }>;
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
