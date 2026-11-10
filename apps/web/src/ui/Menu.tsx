import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
}

/** 点开的小菜单。点外面、按 Esc、选中一项都会收起 */
export function Menu({
  trigger,
  items,
  header,
  align = 'end',
  side = 'bottom',
  label,
  className,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  header?: ReactNode;
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={className ? `menu ${className}` : 'menu'} ref={rootRef}>
      <button
        type="button"
        className={`menu-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div className={`menu-pop is-${align} is-${side}`} role="menu" onClick={(e) => e.stopPropagation()}>
          {header ? <div className="menu-head">{header}</div> : null}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'is-danger' : ''}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
