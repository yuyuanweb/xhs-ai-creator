import type { ContentType } from '../types/deck.js';

/** 小红书图文笔记的平台硬约束，全部来自官方规则而非经验估计 */
export const XHS = {
  /** 单帖图片上限，超了发不出去 */
  MAX_IMAGES: 18,
  /** 官方建议张数，页数越多滑到最后的人越少 */
  RECOMMENDED_MIN: 4,
  RECOMMENDED_MAX: 9,
  /** 笔记正文字数上限。内容装不进正文，只能进图片，正文只写引导语 */
  BODY_TEXT_LIMIT: 1000,
  /** 封面底部被信息流 UI 遮挡的比例，重要信息不能放在这个区间内 */
  COVER_OCCLUSION_RATIO: 0.15,
} as const;

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

/**
 * 各内容类型用多少张原文截图。只说「保留必要的图」模型常常只留一张，
 * 只说「尽量留」又会一页一两张地堆，所以两头都卡住。原文可用的图不够下限时全用上即可
 */
export const TARGET_IMAGES: Record<ContentType, { min: number; max: number }> = {
  opinion: { min: 1, max: 3 },
  listicle: { min: 2, max: 5 },
  review: { min: 3, max: 6 },
  tutorial: { min: 3, max: 7 },
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  opinion: '观点/干货',
  listicle: '清单合集',
  review: '评测对比',
  tutorial: '教程实操',
};
