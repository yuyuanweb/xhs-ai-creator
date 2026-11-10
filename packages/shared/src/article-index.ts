import { imageUnits, sourceUnits } from './outline.js';
import type { SourceArticle, SourceImage } from './types/source.js';

/** 排版体检和修版补丁都要对照的原文信息，打开一篇文章时算一次 */
export interface ArticleIndex {
  images: Map<string, SourceImage>;
  markdown: string;
  /** 截图 id → 它在原文里所属的节（SourceUnit.id） */
  imageUnits: Map<string, string>;
}

export function buildArticleIndex(article: SourceArticle): ArticleIndex {
  return {
    images: new Map(article.images.map((img) => [img.id, img])),
    markdown: article.markdown,
    imageUnits: imageUnits(sourceUnits(article.blocks)),
  };
}
