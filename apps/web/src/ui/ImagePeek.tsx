import { useEffect, useRef } from 'react';
import { Icon } from './icons';

/** 全屏看一张图，点遮罩或按 Esc 关掉 */
export function ImagePeek({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="img-peek" role="dialog" aria-modal="true" aria-label="查看图片" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="icon-btn img-peek-x" aria-label="关闭" onClick={onClose}>
        <Icon name="close" />
      </button>
      <img src={src} alt={alt ?? ''} />
    </div>
  );
}
