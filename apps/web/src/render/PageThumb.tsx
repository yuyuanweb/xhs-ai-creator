import { overlaysOnPage, type Deck, type SourceImage } from '@rcs/shared';
import type { DeckLayout } from '../layout/useDeckLayout';
import { ContentCard } from './ContentCard';
import { CoverCard } from './CoverCard';

/** 不可编辑的整页渲染：页序缩略图、总览网格、发布预览共用 */
export function PageThumb({
  deck,
  images,
  layout,
  index,
  total,
}: {
  deck: Deck;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  index: number;
  total: number;
}) {
  if (index === 0) {
    return (
      <CoverCard
        cover={deck.cover}
        settings={deck.settings}
        total={total}
        overlays={overlaysOnPage(deck.overlays ?? [], 0, layout.pages)}
        images={images}
      />
    );
  }
  const page = layout.pages[index - 1];
  if (!page) return null;
  return (
    <ContentCard
      page={page}
      blocks={layout.blockMap}
      images={images}
      settings={deck.settings}
      pageNo={index + 1}
      total={total}
      overlays={overlaysOnPage(deck.overlays ?? [], index, layout.pages)}
    />
  );
}
