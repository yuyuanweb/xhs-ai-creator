import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { renderInline } from './inline';

type EnterMode = 'newline' | 'commit';

/**
 * 点文字就地改。草稿停在本地，失焦才写回。
 * 边打边写回会触发布局重算，光标和所在页都会被抢走。
 */
export function InlineField({
  value,
  className,
  placeholder,
  style,
  enterMode = 'newline',
  plain = false,
  display,
  selected,
  disabled,
  onSelect,
  onCommit,
}: {
  value: string;
  className: string;
  placeholder?: string;
  style?: CSSProperties;
  enterMode?: EnterMode;
  /** 代码块按原文显示，不解析加粗和链接 */
  plain?: boolean;
  display?: (value: string) => ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const skipCommit = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // 只在点进编辑时聚焦并把光标放到末尾。依赖整段 draft 的话，每打一个字都会重跑，光标被拽到最后。
  const editing = draft !== null;
  useEffect(() => {
    const el = ref.current;
    if (!el || !editing) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [editing]);

  if (draft === null) {
    return (
      <div
        style={style}
        className={`${className}${disabled ? '' : ' is-editable'}${selected ? ' is-on' : ''}${!value && placeholder ? ' is-ghost' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          onSelect?.();
          skipCommit.current = false;
          setDraft(value);
        }}
      >
        {value ? (display ? display(value) : plain ? value : renderInline(value)) : placeholder}
      </div>
    );
  }

  const finish = (commit: boolean) => {
    const next = draft;
    setDraft(null);
    if (commit && next !== value) onCommit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      skipCommit.current = true;
      finish(false);
      return;
    }
    if (e.key === 'Enter' && enterMode === 'commit' && !e.shiftKey) {
      e.preventDefault();
      finish(true);
    }
  };

  return (
    <textarea
      ref={ref}
      className={`${className} card-field`}
      style={style}
      value={draft}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onBlur={() => finish(!skipCommit.current)}
    />
  );
}

/** 列表整组本地改，离开列表才提交，避免每改一项就重新分页 */
export function InlineList({
  items,
  ordered,
  selected,
  disabled,
  onSelect,
  onCommit,
}: {
  items: string[];
  ordered: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onCommit: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [focusAt, setFocusAt] = useState(0);
  const skipCommit = useRef(false);
  const shown = draft ?? items;
  const Tag = ordered ? 'ol' : 'ul';

  const commit = (next: string[]) => {
    const cleaned = next.map((s) => s.trim()).filter(Boolean);
    if (cleaned.join('\n') !== items.join('\n')) onCommit(cleaned);
  };

  return (
    <Tag
      className={`b-list ${ordered ? 'b-ol' : 'b-ul'}${selected ? ' is-on' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        if (draft && !skipCommit.current) commit(draft);
        skipCommit.current = false;
        setDraft(null);
      }}
    >
      {shown.map((item, i) => (
        <li key={i}>
          {draft ? (
            <textarea
              className="card-field"
              value={item}
              rows={1}
              autoFocus={focusAt === i}
              onChange={(e) => {
                const next = [...shown];
                next[i] = e.target.value;
                setDraft(next);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const next = [...shown];
                  next.splice(i + 1, 0, '');
                  setFocusAt(i + 1);
                  setDraft(next);
                }
                if (e.key === 'Escape') {
                  skipCommit.current = true;
                  setDraft(null);
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              onFocus={() => onSelect?.()}
              onWheel={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={disabled ? undefined : 'is-editable'}
              onClick={() => {
                if (disabled) return;
                onSelect?.();
                setFocusAt(i);
                setDraft(items);
              }}
            >
              {renderInline(item)}
            </span>
          )}
        </li>
      ))}
    </Tag>
  );
}
