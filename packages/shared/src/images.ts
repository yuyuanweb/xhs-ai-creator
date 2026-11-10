import type { SourceImage } from './types/source.js';

/** 长边不到这个像素的图多半是表情包、头像、图标，放到卡片上又糊又不像证据 */
const SHOT_MIN_SIDE = 480;

/** 图注比这长基本都是模型在描述它看不到的画面 */
const CAPTION_MAX = 40;

/** 不是原文里的图时，origin 只是个来源记号，不是能重新抓取的地址 */
const UPLOAD_PREFIX = 'upload:';
const COVER_ART_PREFIX = 'cover-art:';

export function uploadOrigin(fileName: string): string {
  return `${UPLOAD_PREFIX}${fileName || 'image'}`;
}

export function coverArtOrigin(): string {
  return `${COVER_ART_PREFIX}${new Date().toISOString()}`;
}

/** 在编辑台里自己上传的图 */
export function isUploadImage(img: SourceImage): boolean {
  return img.origin.startsWith(UPLOAD_PREFIX);
}

/** AI 画的封面图 */
export function isCoverArt(img: SourceImage): boolean {
  return img.origin.startsWith(COVER_ART_PREFIX);
}

/**
 * 能上卡片的原文配图：抓取成功且不是小图。尺寸没量到的不拦。
 * 上传图和 AI 封面图不是原文的证据，不能交给模型当截图用
 */
export function isShot(img: SourceImage | undefined): img is SourceImage {
  if (!img?.url || isUploadImage(img) || isCoverArt(img)) return false;
  if (!img.width || !img.height) return true;
  return Math.max(img.width, img.height) >= SHOT_MIN_SIDE;
}

/**
 * 模型看不到图，图注里凡是具体的英文名、数字、引号里的原话都必须能在原文里找到，
 * 找不到就是照着上下文编的画面细节，印出来会和图对不上。不合格返回 undefined
 */
export function groundedCaption(caption: string | undefined, source: string): string | undefined {
  const text = caption?.trim();
  if (!text) return undefined;
  if (text.replace(/\*/g, '').length > CAPTION_MAX) return undefined;

  const hay = squash(source);
  const quoted = [...text.matchAll(/[「“"'‘『]([^」”"'’』]{2,})[」”"'’』]/g)].map((m) => m[1]!);
  const words = (text.match(/[A-Za-z][\w-]*(?:\.[\w-]+)*/g) ?? []).filter((w) => w.length >= 3);
  const numbers = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return [...quoted, ...words, ...numbers].every((claim) => hay.includes(squash(claim))) ? text : undefined;
}

/** 图注、「留空」这类写给自己看的备注 */
const META_PART = /^\s*(图注|图说)\s*[:：]|图注|留空/;
/** 整段只是一行出处 */
const SOURCE_LINE = /^\s*(来源|数据来源|出处|参考)\s*[:：]/;

/**
 * 正文里只留给读者看的话。模型会顺手写「来源：…｜图注：xx 示意图」「图注未提供，留空」，
 * 前者是一行没人看的出处，后者是写给自己的备注，那张图往往也根本没放进来。
 * 图注只能长在图片块上；整段只剩出处时返回空串，调用方据此丢掉这一块
 */
export function cleanBodyText(text: string): string {
  const parts = text.split(/\s*[｜|；;]\s*/).filter(Boolean);
  const kept = parts.filter((part) => !META_PART.test(part));
  const out = kept.length === parts.length ? text.trim() : kept.join('；').trim();
  return SOURCE_LINE.test(out) ? '' : out;
}

function squash(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}
