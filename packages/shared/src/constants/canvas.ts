/** 卡片的物理度量。渲染、测高、分页、导出共用同一套数字，任何一处单独改都会让预览和成品漂移 */
export const PAGE_W = 1080;
export const PAGE_H = 1440;
export const PAD_X = 72;

const HEAD_TOP = 56;
const HEAD_H = 40;
const HEAD_GAP = 30;
const FOOT_GAP = 24;
const FOOT_H = 46;
const PAD_BOTTOM = 44;

export const CONTENT_W = PAGE_W - PAD_X * 2;
export const CONTENT_H = PAGE_H - HEAD_TOP - HEAD_H - HEAD_GAP - FOOT_GAP - FOOT_H - PAD_BOTTOM;

export const LAYOUT = { HEAD_TOP, HEAD_H, HEAD_GAP, FOOT_GAP, FOOT_H, PAD_BOTTOM } as const;

/**
 * 一页的合格填充率。低于这条线就是「下面空一大截」，
 * 只能靠合并邻页或者把本页写厚来解决，不允许靠上下留白假装排版。
 */
export const MIN_FILL = 0.76;

/**
 * 截图高度上限。截图是教程页的证据，给到接近半页才看得清里面的小字；
 * 给得太小，页面下半部分就只剩空白。
 */
export const IMAGE_MAX_H = 620;

/** 截图底台的内边距。分页要按这个值倒推图本身的高度，所以不随主题变 */
export const SHOT_INSET = 26;

/** 小图放大的上限倍数，超过会把表情包、局部截图拉成马赛克 */
export const IMAGE_MAX_UPSCALE = 1.6;
