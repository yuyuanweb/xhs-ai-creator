import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PAGE_H, PAGE_W } from '@rcs/shared';

/**
 * 把 1080×1440 的卡片等比缩到容器宽度。宽度由外层布局决定（网格、手机框），
 * 这里量出来再换算缩放比，调用方不用关心卡片原始尺寸
 */
export function ScaledCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / PAGE_W);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`scaled-card${className ? ` ${className}` : ''}`} style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
      {scale > 0 ? (
        <div className="scaled-card-inner" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})` }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
