import type { ContentType } from '../types/deck.js';

export const COVER_OCCLUSION_PX = 246;

/**
 * 各内容类型的目标卡片数（含封面）。
 * 教程类放宽的原因：离开截图就找不到位置的操作图删不得，其余步骤靠序号行压缩。
 */
export const TARGET_CARDS: Record<ContentType, { min: number; max: number; default: number }> = {
  opinion: { min: 4, max: 9, default: 7 },
  listicle: { min: 5, max: 10, default: 8 },
  review: { min: 5, max: 12, default: 9 },
  tutorial: { min: 7, max: 14, default: 10 },
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  opinion: '观点/干货',
  listicle: '清单合集',
  review: '评测对比',
  tutorial: '教程实操',
};
