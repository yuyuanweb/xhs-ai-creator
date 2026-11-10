/** 原文块与卡片块共用的块类型 */
export type BlockKind = 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'image' | 'code' | 'quote';

/** 解析原始 Markdown 得到的块，只读，不参与编排 */
export interface SourceBlock {
  id: string;
  kind: BlockKind;
  /** h2 / h3 / p / quote 的行内 Markdown 原文 */
  text?: string;
  /** ul / ol 的条目 */
  items?: string[];
  /** image 指向 SourceImage.id */
  imageId?: string;
  lang?: string;
  code?: string;
  /** 所属二级标题，供 AI 理解文章结构 */
  section?: string;
  /** 所属三级标题 */
  sub?: string;
}

export interface SourceImage {
  id: string;
  /** 原始远程地址。本地副本丢失后凭它重新抓取，所以永远不能丢 */
  origin: string;
  /** 转存后的可访问地址。公众号图有 referer 防盗链，必须走转存 */
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface SourceArticle {
  id: string;
  title: string;
  markdown: string;
  blocks: SourceBlock[];
  images: SourceImage[];
  createdAt: string;
  updatedAt: string;
}
