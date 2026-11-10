import { useEffect, useRef } from 'react';
import { CONTENT_W, IMAGE_MAX_UPSCALE, findTheme, type CardBlock, type DeckSettings, type SourceImage } from '@rcs/shared';
import { BlockView } from './BlockView';
import { themeVars } from './theme-vars';

export interface Measurements {
  /** 每块连同下边距的整体高度，装箱用 */
  heights: Record<string, number>;
  /** 每块的下边距。块排在页末时渲染会把它清零，装箱不扣掉的话每页平白空出二十来像素 */
  tails: Record<string, number>;
  /** 图片块里图本身的高度。缩图只缩这一截，图注和间距不跟着变，按整块算会把缩放算错 */
  pictures: Record<string, number>;
  /** 图片最多还能放大到测高尺寸的几倍：被高度上限卡窄的截图，页面有余量时要拉回和正文齐宽 */
  grows: Record<string, number>;
}

export const EMPTY_MEASUREMENTS: Measurements = { heights: {}, tails: {}, pictures: {}, grows: {} };

export interface MeasurerProps {
  blocks: CardBlock[];
  images: Map<string, SourceImage>;
  settings: DeckSettings;
  /** 带上量的是哪一版块，调用方才分得清这份高度是不是最新的 */
  onMeasure: (m: Measurements, blocks: CardBlock[]) => void;
}

/**
 * 在屏幕外按卡片正文宽度渲染所有块，量出每一块的真实高度。
 * 分页完全建立在这份测量上，不做「按字数猜行数」的近似——
 * 单页看不出差别，连续十几页就会失控。
 *
 * 这个容器必须始终挂载：历史上出现过加载态提前 return 导致测量永不触发、
 * 页面永久停在加载中的问题，而导出路径因为走另一个分支躲过了，很晚才被发现。
 */
export function Measurer({ blocks, images, settings, onMeasure }: MeasurerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = findTheme(settings.themeId);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;

    const measure = () => {
      if (cancelled || !ref.current) return;
      const m: Measurements = { heights: {}, tails: {}, pictures: {}, grows: {} };
      ref.current.querySelectorAll<HTMLElement>('[data-block-id]').forEach((el) => {
        const id = el.dataset.blockId;
        if (!id) return;
        m.heights[id] = el.getBoundingClientRect().height;
        const root = el.firstElementChild;
        m.tails[id] = root ? parseFloat(getComputedStyle(root).marginBottom) || 0 : 0;
        const img = el.querySelector('img');
        if (!img) return;
        const box = img.getBoundingClientRect();
        m.pictures[id] = box.height;
        const grow = maxGrow(img, box.width, el.clientWidth * (settings.imageScale / 100));
        if (grow > 1) m.grows[id] = grow;
      });
      onMeasure(m, blocks);
    };

    const pending = Array.from(root.querySelectorAll('img')).filter(
      (im) => !im.complete || im.naturalWidth === 0,
    );

    if (!pending.length) {
      requestAnimationFrame(measure);
    } else {
      let left = pending.length;
      const done = () => {
        if (--left <= 0) requestAnimationFrame(measure);
      };
      pending.forEach((im) => {
        im.addEventListener('load', done, { once: true });
        im.addEventListener('error', done, { once: true });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [blocks, images, settings, onMeasure]);

  return (
    <div
      ref={ref}
      className={`card measure${settings.marker ? '' : ' no-marker'}`}
      data-mode={theme.mode}
      style={{ ...themeVars(theme, settings), width: CONTENT_W }}
      aria-hidden
    >
      {blocks.map((b) => (
        <div data-block-id={b.id} key={b.id}>
          <BlockView block={b} images={images} />
        </div>
      ))}
    </div>
  );
}

/** 宽度上限跟渲染时一致：不超过配图宽度设置，也不把小图放大到原始像素的 1.6 倍以上 */
function maxGrow(img: HTMLImageElement, width: number, limit: number): number {
  if (!width || !img.naturalWidth) return 1;
  return Math.min(limit, img.naturalWidth * IMAGE_MAX_UPSCALE) / width;
}
