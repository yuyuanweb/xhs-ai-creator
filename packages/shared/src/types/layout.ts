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
