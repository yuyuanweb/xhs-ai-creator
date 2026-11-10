import type { CoverVariant } from './deck.js';

/**
 * 视觉体系。一套图只能用一种，不能混搭：
 * swiss 靠网格、细线、单一高饱和强调色说话；paper 是论文科普的纸感，衬线标题配无衬线正文；
 * memo 是方格纸上的圆角便签和胶带；neon 是深色底上的终端窗口和霓虹色；pop 是粗黑描边、硬投影的撞色块。
 */
export type ThemeMode = 'swiss' | 'paper' | 'memo' | 'neon' | 'pop';

/** 可切换的强调色。换色不换版式，所以只有和强调色相关的几项 */
export interface ThemeAccent {
  id: string;
  name: string;
  accent: string;
  /** 强调色上的反白文字色 */
  onAccent: string;
  /** 强调色当文字用时的颜色。浅色强调（如荧光绿）直接印在浅底上看不清，需要单独给深一档；缺省即 accent */
  accentInk?: string;
  /** 加粗文字的荧光笔颜色，需要带透明度才不会盖住字 */
  marker: string;
}

/**
 * 主题令牌。每一项都会以 CSS 变量的形式注入卡片根节点，
 * 所以新增一套主题不需要改任何渲染组件。
 */
export interface ThemeTokens {
  bg: string;
  /** 组件卡片的底色，比页面底色略亮或略暗一档 */
  surface: string;
  text: string;
  heading: string;
  muted: string;
  /** 风险、边界、「不适合」这类提醒专用色，不随强调色切换 */
  warn: string;
  divider: string;
  codeBg: string;
  codeText: string;
  imageRadius: string;
  imageBorder: string;
  bodyFont: string;
  headingFont: string;
  codeFont: string;
  /** 章节标题字重 */
  headingWeight: string;
  /**
   * 封面主标题字重。遵循「越大越轻」：
   * 百来号字还用 800/900 会立刻掉到落地页横幅的档次。
   */
  displayWeight: string;
  /** 封面主标题字距。轻字重要靠正字距撑开，负字距会挤成一坨 */
  displayTracking: string;
}

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  /** 一句话说明这套主题适合什么内容，展示在选择器里，也交给模型挑主题 */
  description: string;
  tokens: ThemeTokens;
  /** 第一个是默认强调色 */
  accents: ThemeAccent[];
  /** 第一个是专属封面，其余是备选 */
  coverVariants: CoverVariant[];
}
