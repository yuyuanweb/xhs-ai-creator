import { useEffect, useRef, type ReactNode } from 'react';
import { create } from 'zustand';
import { Icon, type IconName } from './icons';

/* ---------- 轻提示 ---------- */

type ToastTone = 'success' | 'error' | 'info' | 'warn';

interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastState {
  items: ToastItem[];
  push: (tone: ToastTone, text: string, ms?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (tone, text, ms = tone === 'error' ? 6000 : 3200) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-3), { id, tone, text }] }));
    window.setTimeout(() => get().dismiss(id), ms);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (text: string) => useToasts.getState().push('success', text),
  error: (text: string) => useToasts.getState().push('error', text),
  info: (text: string) => useToasts.getState().push('info', text),
  warn: (text: string, ms?: number) => useToasts.getState().push('warn', text, ms),
};

const TOAST_ICON: Record<ToastTone, IconName> = {
  success: 'checkCircle',
  error: 'warn',
  info: 'info',
  warn: 'warn',
};

function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast is-${t.tone}`}>
          <Icon name={TOAST_ICON[t.tone]} size={18} />
          <span>{t.text}</span>
          <button type="button" aria-label="关闭" onClick={() => dismiss(t.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- 确认框 ---------- */

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState {
  pending: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useConfirm = create<ConfirmState>((set, get) => ({
  pending: null,
  open: (options) =>
    new Promise<boolean>((resolve) => {
      get().pending?.resolve(false);
      set({ pending: { ...options, resolve } });
    }),
  close: (ok) => {
    get().pending?.resolve(ok);
    set({ pending: null });
  },
}));

export const confirmDialog = (options: ConfirmOptions) => useConfirm.getState().open(options);

function ConfirmHost() {
  const { pending, close } = useConfirm();
  if (!pending) return null;
  return (
    <Dialog onClose={() => close(false)} width={400}>
      <div className="dlg-head">
        {pending.danger ? (
          <span className="dlg-badge is-danger">
            <Icon name="warn" size={18} />
          </span>
        ) : null}
        <h3>{pending.title}</h3>
      </div>
      {pending.body ? <div className="dlg-body">{pending.body}</div> : null}
      <div className="dlg-acts">
        <button type="button" className="btn" onClick={() => close(false)}>
          {pending.cancelText ?? '取消'}
        </button>
        <button
          type="button"
          className={`btn ${pending.danger ? 'is-danger' : 'is-primary'}`}
          autoFocus
          onClick={() => close(true)}
        >
          {pending.confirmText ?? '确定'}
        </button>
      </div>
    </Dialog>
  );
}

/* ---------- 对话框外壳 ---------- */

export function Dialog({
  children,
  onClose,
  width = 440,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  width?: number;
  label?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
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
    if (!boxRef.current?.contains(document.activeElement)) boxRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="dlg-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={boxRef}
        className="dlg"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      >
        {children}
      </div>
    </div>
  );
}

/** 全局反馈层：轻提示和确认框各挂一份，任何地方都能直接调用 toast / confirmDialog */
export function FeedbackHost() {
  return (
    <>
      <Toaster />
      <ConfirmHost />
    </>
  );
}

export function errorText(err: unknown, fallback = '操作失败，请重试'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
