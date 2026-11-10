import type { SourceArticle, SourceImage } from './types/source.js';

/** 渲染卡片时要对照的原文信息，打开一篇文章时算一次 */
export interface ArticleIndex {
  images: Map<string, SourceImage>;
}

export function buildArticleIndex(article: SourceArticle): ArticleIndex {
  return {
    images: new Map(article.images.map((img) => [img.id, img])),
  };
}
