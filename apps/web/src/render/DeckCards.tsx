import type { ReactNode } from 'react';
import { overlaysOnPage, type CardBlock, type Deck, type LayoutPage, type SourceImage } from '@rcs/shared';
import { CoverCard } from './CoverCard';
import { ContentCard } from './ContentCard';

export interface CardSlot {
  /** 导出后的文件名，也是导出器定位节点的依据 */
  name: string;
  node: ReactNode;
}

export function buildSlots(
  deck: Deck,
  pages: LayoutPage[],
  blockMap: Map<string, CardBlock>,
  images: Map<string, SourceImage>,
): CardSlot[] {
  const total = pages.length + 1;
  const slots: CardSlot[] = [
    {
      name: '01-封面',
      node: (
        <CoverCard
          cover={deck.cover}
          settings={deck.settings}
          total={total}
          overlays={overlaysOnPage(deck.overlays ?? [], 0, pages)}
          images={images}
        />
      ),
    },
  ];

  pages.forEach((page, i) => {
    const no = i + 2;
    slots.push({
      name: `${String(no).padStart(2, '0')}-${page.section || '正文'}`.replace(/[/\\:*?"<>|]/g, ''),
      node: (
        <ContentCard
          page={page}
          blocks={blockMap}
          images={images}
          settings={deck.settings}
          pageNo={no}
          total={total}
          overlays={overlaysOnPage(deck.overlays ?? [], i + 1, pages)}
        />
      ),
    });
  });

  return slots;
}

/** 导出器按 data-card-name 逐个截图，所以这层包装不能加任何影响布局的样式 */
export function CardStrip({ slots }: { slots: CardSlot[] }) {
  return (
    <>
      {slots.map((s) => (
        <div className="card-slot" data-card-name={s.name} key={s.name}>
          {s.node}
        </div>
      ))}
    </>
  );
}
