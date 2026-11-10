import { useEffect } from 'react';
import { PAGE_W, type Deck, type SourceImage } from '@rcs/shared';
import type { DeckLayout } from '../../layout/useDeckLayout';
import { PageThumb } from '../../render/PageThumb';

/** 右侧页序缩略图宽度。高度按 3:4 画幅跟卡片走 */
const THUMB_W = 72;

export function PageRail({
  deck,
  images,
  layout,
  index,
  total,
  onPick,
}: {
  deck: Deck;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  index: number;
  total: number;
  onPick: (index: number) => void;
}) {
  useEffect(() => {
    document.getElementById(`rail-${index}`)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [index]);

  return (
    <nav className="st-rail" aria-label="页面">
      {Array.from({ length: total }, (_, i) => {
        const page = layout.pages[i - 1];
        return (
          <button
            id={`rail-${i}`}
            key={i}
            type="button"
            className={`rail-item${i === index ? ' is-on' : ''}${page?.overflow ? ' is-bad' : ''}`}
            onClick={() => onPick(i)}
          >
            <span className="rail-frame">
              <span className="rail-scale" style={{ transform: `scale(${THUMB_W / PAGE_W})` }}>
                <PageThumb deck={deck} images={images} layout={layout} index={i} total={total} />
              </span>
            </span>
            <span className="rail-no">{i === 0 ? '封面' : String(i + 1).padStart(2, '0')}</span>
          </button>
        );
      })}
    </nav>
  );
}
