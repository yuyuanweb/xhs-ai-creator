import type { BlockKind } from './source.js';

/**
 * 分页意图。break = 该块前强制换页；join = 必须跟上一块同页。
 * AI 用它表达表达节奏，排版引擎在此基础上仍保证物理上装得下。
 */
export type BreakHint = 'break' | 'join';

/**
 * 卡片独有的组件块。原文解析不会产出它们，只有改写时才会用到：
 * steps 序号行、stats 大数字、cards 卡片组、callout 提示框、table 表格、flow 流程图、chart 条形图
 */
export type ComponentKind = 'steps' | 'stats' | 'cards' | 'callout' | 'table' | 'flow' | 'chart';

export type CardBlockKind = BlockKind | ComponentKind;

export const COMPONENT_KINDS: ComponentKind[] = ['steps', 'stats', 'cards', 'callout', 'table', 'flow', 'chart'];

/**
 * 组件里的一项。字段按组件取用：
 * steps / flow 用 title + text；stats 用 label + value + text；cards 用 label + title + text；
 * chart 用 label + value，value 里必须有一个能比大小的数字
 */
export interface BlockEntry {
  label?: string;
  title?: string;
  value?: string;
  text?: string;
}

/** 提示框语气。accent 是结论，dark 是压轴的一句话，warn 是风险和边界 */
export type CalloutTone = 'accent' | 'dark' | 'warn';

/** 序号行的行首记号。number 是 01 / 02，arrow 是 ↳，用于「顺着往下推」的要点 */
export type StepMarker = 'number' | 'arrow';

/** 卡片上的块。内容由 AI 改写而来，不是原文的直接搬运 */
export interface CardBlock {
  id: string;
  kind: CardBlockKind;
  text?: string;
  items?: string[];
  /** 指向 SourceImage.id */
  imageId?: string;
  lang?: string;
  code?: string;
  /** callout 的小标签；chart 的图题 */
  label?: string;
  /** steps / stats / cards / flow / chart 的条目 */
  entries?: BlockEntry[];
  /** table 的行，第一行是表头 */
  rows?: string[][];
  tone?: CalloutTone;
  marker?: StepMarker;
  /** cards / flow / chart 里高亮的那一项，从 0 开始；不高亮时省略 */
  highlight?: number;
  /** 顶部章节标签 */
  section?: string;
  /** 只给 h2 用：这一页讲的是原文哪几节（SourceUnit.id），用来对账有没有漏讲、截图有没有串节 */
  sources?: string[];
  breakHint?: BreakHint;
}

/**
 * 封面变体决定版式和用到哪些文案字段，长相由主题决定：
 * poster 流程海报、digest 摘要页、checklist 清单便签是各主题的专属封面；headline 大标题是共用的备选。
 */
export type CoverVariant = 'poster' | 'digest' | 'headline' | 'checklist';

export interface CoverFlowNode {
  title: string;
  lines: string[];
}

/**
 * 封面文案。判断标准只有一个：双列缩略图尺寸下标题能否一眼读完。
 * title 用 \n 手动断行，**包起来的字** 渲染成强调色块反白。
 */
export interface CoverSpec {
  title: string;
  /** 标题上方的一句引子或品类标签 */
  kicker?: string;
  /** 标题下面的导语，digest / headline / checklist 变体用 */
  lead?: string;
  /** headline 变体的利益点短标签，3 个以内、每个 6 字以内 */
  chips?: string[];
  /** poster 变体底部两栏的要点；checklist 变体便签上的勾选清单 */
  points?: string[];
  /** poster 变体中间的「从 A 到 B」流程框 */
  flow?: { from: CoverFlowNode; to: CoverFlowNode };
  /** digest 变体的「是什么 / 怎么做到 / 有什么用」 */
  facts?: Array<{ label: string; text: string }>;
  /** digest 变体底部的一排统计数字 */
  stats?: Array<{ value: string; label: string }>;
  /** digest 变体最下方的一句全篇概述 */
  note?: string;
  variant: CoverVariant;
}

/** 浮在页面上的装饰，不参与测高分页 */
export type OverlayKind = 'emoji' | 'icon' | 'image';

export interface PageOverlay {
  id: string;
  /** 封面用 cover，内容页锚定到该页上的一块（通常是 h2），分页变了跟着走 */
  anchor: string;
  kind: OverlayKind;
  emoji?: string;
  icon?: string;
  imageId?: string;
  /** 相对整张卡片的位置，0 到 100 */
  x: number;
  y: number;
  /** 相对卡片宽度的百分比 */
  size: number;
  rotate?: number;
}

/** 内容类型决定目标张数：教程需要保留操作截图，压不到观点文那么短 */
export type ContentType = 'opinion' | 'tutorial' | 'listicle' | 'review';

export interface DeckSettings {
  themeId: string;
  /** 主题里可切换的强调色 */
  accentId: string;
  /** 全篇统一字号。连续滑十几页时字号跳变会显得业余，所以不按页浮动 */
  fontSize: number;
  /** 配图宽度占正文宽度的百分比 */
  imageScale: number;
  /** 加粗是否走荧光笔 */
  marker: boolean;
  showPageNumber: boolean;
  /** 主题自带的装饰图形，画在页边和角落，不占版面 */
  decor: boolean;
  /** 署名 / 栏目，如「松柏 / 独立开发实战」。填一次，新稿子沿用 */
  byline: string;
  /** 这篇的话题，如「个人小程序 · 虚拟支付」。由模型每篇生成 */
  topic: string;
  /** 页脚左下：一句话概括整篇文章的主题，每页都印，不能只概括开头某一节。由模型每篇生成 */
  series: string;
  /** 目标卡片总数（含封面） */
  targetCards: number;
}

export type DeckStatus = 'draft' | 'generating' | 'ready';

/** 一篇原文的一份卡片稿。Agent 交稿后即退场，后续改动全部来自人工 */
export interface Deck {
  id: string;
  articleId: string;
  contentType: ContentType;
  blocks: CardBlock[];
  cover: CoverSpec;
  settings: DeckSettings;
  /** 人工关掉的块，保留在稿子里以便随时恢复 */
  disabledBlockIds: string[];
  /** 浮在各页上的图标、表情、上传图，不占版面 */
  overlays: PageOverlay[];
  status: DeckStatus;
  createdAt: string;
  updatedAt: string;
}
