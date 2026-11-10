import { useCallback, useState } from 'react';
import type { CoverArtRequest, CoverSpec, SourceArticle } from '@rcs/shared';
import { deckApi } from '../api/endpoints';
import { errorText, toast } from '../ui/feedback';
import type { UpdateDeck } from './useDeckEditor';

export interface CoverArt {
  generating: boolean;
  generate: (req: CoverArtRequest) => Promise<void>;
  /** 换上一张封面图；不传就切回排版封面 */
  apply: (imageId?: string) => void;
}

/**
 * AI 封面图的生成和切换。状态放在编辑台这一层：
 * 一次要等几十秒，期间翻到别的页、面板被卸掉，画好的图照样能换上去
 */
export function useCoverArt(deckId: string, onArticleChange: (article: SourceArticle) => void, updateDeck: UpdateDeck): CoverArt {
  const [generating, setGenerating] = useState(false);

  const apply = useCallback(
    (imageId?: string) => updateDeck((prev) => ({ ...prev, cover: withCoverImage(prev.cover, imageId) })),
    [updateDeck],
  );

  const generate = useCallback(
    async (req: CoverArtRequest) => {
      setGenerating(true);
      try {
        const { article, imageIds } = await deckApi.generateCoverArt(deckId, req);
        onArticleChange(article);
        if (imageIds[0]) apply(imageIds[0]);
        toast.success(imageIds.length > 1 ? `画好了 ${imageIds.length} 张，已换上第一张` : '封面图画好了');
      } catch (err) {
        toast.error(errorText(err, '封面图生成失败'));
      } finally {
        setGenerating(false);
      }
    },
    [deckId, onArticleChange, apply],
  );

  return { generating, generate, apply };
}

function withCoverImage(cover: CoverSpec, imageId?: string): CoverSpec {
  const { imageId: _old, ...rest } = cover;
  return imageId ? { ...rest, imageId } : rest;
}
