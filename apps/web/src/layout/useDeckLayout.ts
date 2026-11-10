import { useCallback, useMemo, useState } from 'react';
import type { CardBlock, Deck, LayoutPage } from '@rcs/shared';
import { EMPTY_MEASUREMENTS, type Measurements } from '../render/Measurer';
import { paginate } from './paginate';

export interface DeckLayout {
  activeBlocks: CardBlock[];
  blockMap: Map<string, CardBlock>;
  pages: LayoutPage[];
  /** 测高落定前不要渲染卡片，否则会闪一屏错误的分页 */
  measured: boolean;
  /** 高度和当前内容、字号完全对得上。Agent 只能读这时的体检结果，否则改了文字拿到的还是旧分页 */
  settled: boolean;
  onMeasure: (m: Measurements, blocks: CardBlock[]) => void;
}

interface MeasureCache extends Measurements {
  key: string;
  blocks: CardBlock[] | null;
}

/** 改了字号或配图宽度，之前量的高度就全部作废 */
function metricsKeyOf(deck: Deck): string {
  const s = deck.settings;
  return `${s.fontSize}|${s.imageScale}|${s.themeId}|${s.marker}`;
}

/**
 * 排版的单一入口：测高结果进来，分页结果出去。
 * 画布、页面导航和总览都读这里的输出，所以各处看到的分页永远一致。
 */
export function useDeckLayout(deck: Deck): DeckLayout {
  const metricsKey = metricsKeyOf(deck);
  const [cache, setCache] = useState<MeasureCache>({ key: metricsKey, blocks: null, ...EMPTY_MEASUREMENTS });

  // 拖字号、配图时测高会空一拍。那一拍如果把旧高度丢掉，画布会卸掉重装，看起来就是抖。
  const { heights, tails, pictures, grows } = cache;

  const disabled = useMemo(() => new Set(deck.disabledBlockIds), [deck.disabledBlockIds]);
  const activeBlocks = useMemo(() => deck.blocks.filter((b) => !disabled.has(b.id)), [deck.blocks, disabled]);
  const blockMap = useMemo(() => new Map(deck.blocks.map((b) => [b.id, b])), [deck.blocks]);

  const measured = activeBlocks.length > 0 && activeBlocks.every((b) => heights[b.id] !== undefined);
  const settled = measured && cache.key === metricsKey && cache.blocks === activeBlocks;

  const pages = useMemo(
    () => (measured ? paginate(activeBlocks, { heights, tails, pictures, grows }) : []),
    [measured, activeBlocks, heights, tails, pictures, grows],
  );

  const onMeasure = useCallback(
    (m: Measurements, blocks: CardBlock[]) => {
      setCache((prev) => {
        const same = prev.key === metricsKey && sameMeasurements(prev, m);
        if (same && prev.blocks === blocks) return prev;
        // 高度没变就沿用原对象，免得只因为换了一版块引用就重算整套分页
        return same ? { ...prev, blocks } : { key: metricsKey, blocks, ...m };
      });
    },
    [metricsKey],
  );

  return { activeBlocks, blockMap, pages, measured, settled, onMeasure };
}

function sameMeasurements(a: Measurements, b: Measurements): boolean {
  return (
    shallowEqual(a.heights, b.heights) &&
    shallowEqual(a.tails, b.tails) &&
    shallowEqual(a.pictures, b.pictures) &&
    shallowEqual(a.grows, b.grows)
  );
}

function shallowEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}
