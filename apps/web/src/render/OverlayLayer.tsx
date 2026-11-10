import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { DECOR_ICONS, type PageOverlay, type SourceImage } from '@rcs/shared';

export const OVERLAY_SIZE_MIN = 4;
export const OVERLAY_SIZE_MAX = 40;

export interface OverlayLive {
  disabled?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, size: number) => void;
  onRemove?: (id: string) => void;
}

export function OverlayLayer({
  overlays,
  images,
  live,
}: {
  overlays: PageOverlay[];
  images: Map<string, SourceImage>;
  live?: OverlayLive;
}) {
  if (!overlays.length && !live) return null;

  return (
    <div className="c-float">
      {overlays.map((o) => (
        <Sticker key={o.id} overlay={o} images={images} live={live} />
      ))}
    </div>
  );
}

function Sticker({
  overlay: o,
  images,
  live,
}: {
  overlay: PageOverlay;
  images: Map<string, SourceImage>;
  live?: OverlayLive;
}) {
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const selected = live?.selectedId === o.id;

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || live.disabled) return;
    e.stopPropagation();
    e.preventDefault();
    live.onSelect?.(o.id);
    const host = e.currentTarget.closest('.card');
    if (!host) return;
    const rect = host.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      const dx = ((ev.clientX - drag.current.x) / rect.width) * 100;
      const dy = ((ev.clientY - drag.current.y) / rect.height) * 100;
      live.onMove?.(o.id, clampPct(drag.current.ox + dx), clampPct(drag.current.oy + dy));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onResizeDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!live || live.disabled) return;
    e.stopPropagation();
    e.preventDefault();
    const host = e.currentTarget.closest('.card');
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, size: o.size };
    const move = (ev: PointerEvent) => {
      const delta = (((ev.clientX - start.x) + (ev.clientY - start.y)) / 2 / rect.width) * 100;
      live.onResize?.(o.id, clampSize(start.size + delta));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // 缩略图和导出也会渲染贴纸，外层可能就是按钮，这里不能再用 button
  return (
    <div
      role={live ? 'button' : undefined}
      className={`c-sticker${selected ? ' is-on' : ''}`}
      style={{
        left: `${o.x}%`,
        top: `${o.y}%`,
        width: `${o.size}%`,
        transform: `translate(-50%, -50%)${o.rotate ? ` rotate(${o.rotate}deg)` : ''}`,
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <StickerFace overlay={o} images={images} />
      {selected && live && !live.disabled ? (
        <>
          <span
            className="c-sticker-x"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              live.onRemove?.(o.id);
            }}
          >
            ×
          </span>
          <span className="c-sticker-resize" onPointerDown={onResizeDown} />
        </>
      ) : null}
    </div>
  );
}

function StickerFace({ overlay: o, images }: { overlay: PageOverlay; images: Map<string, SourceImage> }) {
  if (o.kind === 'image') {
    const img = o.imageId ? images.get(o.imageId) : undefined;
    return img?.url ? <img src={img.url} alt="" draggable={false} /> : null;
  }
  if (o.kind === 'icon') {
    const icon = DECOR_ICONS.find((i) => i.id === o.icon);
    if (!icon?.path) return null;
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon.path} />
      </svg>
    );
  }
  return <span className="c-sticker-face">{o.emoji}</span>;
}

function clampPct(n: number): number {
  return Math.min(98, Math.max(2, n));
}

function clampSize(n: number): number {
  return Math.min(OVERLAY_SIZE_MAX, Math.max(OVERLAY_SIZE_MIN, Math.round(n * 10) / 10));
}
