/** 一页正文卡片的排版结果 */
export interface LayoutPage {
  index: number;
  blockIds: string[];
  section: string;
  /** 第几章，按 h2 从 1 数起；第一个 h2 之前的开篇内容没有章号 */
  chapter?: number;
  /** 续页：本页开头不是标题，渲染时章节标签要带「续」 */
  continued: boolean;
  /** 填充率 = 内容高度 / 可用高度 */
  fill: number;
  overflow: boolean;
  /** 为了塞进本页而缩小的图片：块 id → 缩放系数 */
  imageScales?: Record<string, number>;
}

/**
 * 排版体检报告。这是 Agent 唯一的客观反馈来源——
 * 有了它模型就不必猜页面容量，可以直接看测量结果决定要不要改。
 */
export interface LayoutReport {
  /** 含封面的总张数，用来对照平台上限 */
  totalCards: number;
  contentPages: number;
  /** 内容溢出的页序号，正常情况下应当为空 */
  overflowPages: number[];
  /** 填充率过低的页序号，对应「一句话独占一页」这类业余排版 */
  thinPages: number[];
  avgFill: number;
  fills: number[];
  /** 超过小红书单帖 18 张上限 */
  exceedsPlatformLimit: boolean;
  /** 落在当前内容类型的目标区间内 */
  withinTarget: boolean;
  /** 卡片里用上的原文配图张数 */
  imagesUsed: number;
  /** 截图张数的合理区间：按内容类型定，原文可用的图不够下限时取原文张数 */
  imagesMin: number;
  imagesMax: number;
}
