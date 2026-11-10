import type { Deck, SourceImage } from '@rcs/shared';
import type { DeckLayout } from '../../layout/useDeckLayout';
import { PageThumb } from '../../render/PageThumb';
import { ScaledCard } from '../../render/ScaledCard';
import { PageTag, pageLabel } from './PageTag';

/** 总览：整组卡片平铺成网格，一眼看完节奏和哪几页有问题，点一张回到画布 */
export function DeckOverview({
  deck,
  images,
  layout,
  total,
  index,
  onPick,
}: {
  deck: Deck;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  total: number;
  index: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="st-overview">
      <div className="ov-head">
        <b>全部 {total} 张</b>
        <span>点任意一张回到画布编辑</span>
      </div>
      <div className="ov-grid">
        {Array.from({ length: total }, (_, i) => {
          const page = layout.pages[i - 1];
          return (
            <button
              key={i}
              type="button"
              className={`ov-item${i === index ? ' is-on' : ''}${page?.overflow ? ' is-bad' : ''}`}
              onClick={() => onPick(i)}
            >
              <span className="ov-frame">
                <ScaledCard>
                  <PageThumb deck={deck} images={images} layout={layout} index={i} total={total} />
                </ScaledCard>
              </span>
              <span className="ov-cap">
                <b>{pageLabel(i)}</b>
                {page ? <PageTag fill={page.fill} overflow={page.overflow} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
