import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../ui/icons';

export function BlockMenu({
  targetId,
  note,
  disabled,
  onNote,
  onRewrite,
  onRemove,
}: {
  targetId: string;
  note?: string;
  disabled: boolean;
  onNote: (note: string) => void;
  onRewrite: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? '');

  useEffect(() => setDraft(note ?? ''), [note, targetId]);

  useEffect(() => {
    const place = () => {
      const hit = document.querySelector(`[data-block-id="${targetId}"]`);
      const box = hit instanceof HTMLElement ? (hit.firstElementChild instanceof HTMLElement ? hit.firstElementChild : hit) : null;
      if (!box) {
        setPos(null);
        return;
      }
      const rect = box.getBoundingClientRect();
      const width = 220;
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right + 8));
      const top = Math.min(window.innerHeight - 160, Math.max(12, rect.top));
      setPos({ top, left });
    };
    place();
    const timer = window.setInterval(place, 400);
    window.addEventListener('resize', place);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', place);
    };
  }, [targetId]);

  if (!pos) return null;

  return (
    <div ref={ref} className="blk-menu" style={{ top: pos.top, left: pos.left }}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}>
        <Icon name="comment" />
        给 AI 的批注
      </button>
      {open ? (
        <textarea
          value={draft}
          placeholder="这一块想改成什么样，重新生成时会带上"
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onNote(draft.trim())}
        />
      ) : null}
      <button type="button" disabled={disabled} onClick={onRewrite}>
        <Icon name="generate" />
        单独重新生成
      </button>
      <button type="button" className="is-danger" disabled={disabled} onClick={onRemove}>
        <Icon name="trash" />
        删除这一块
      </button>
    </div>
  );
}
