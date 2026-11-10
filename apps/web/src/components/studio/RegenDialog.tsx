import { useState } from 'react';
import { Dialog } from '../../ui/feedback';
import { Icon } from '../../ui/icons';

export interface RegenPageOption {
  index: number;
  label: string;
  dirty: boolean;
}

export function RegenDialog({
  pages,
  dirty,
  onCancel,
  onConfirm,
}: {
  pages: RegenPageOption[];
  dirty: number[];
  onCancel: () => void;
  onConfirm: (indexes: number[] | 'all') => void;
}) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set(dirty));
  const allPicked = picked.size === pages.length;

  const toggle = (index: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <Dialog onClose={onCancel} width={460} label="重新生成">
      <div className="dlg-head">
        <span className="dlg-badge">
          <Icon name="generate" size={18} />
        </span>
        <h3>检测到人工改动</h3>
      </div>
      <div className="dlg-body">
        标了「改过」的页有你亲手改的内容或给 AI 的批注。勾选要重新生成的页，没勾的会原样保留。
      </div>
      <div className="dlg-pick-head">
        <span>已选 {picked.size} / {pages.length} 页</span>
        <button
          type="button"
          className="link"
          onClick={() => setPicked(allPicked ? new Set() : new Set(pages.map((p) => p.index)))}
        >
          {allPicked ? '清空' : '全选'}
        </button>
      </div>
      <ul className="dlg-pages">
        {pages.map((p) => (
          <li key={p.index}>
            <label className={picked.has(p.index) ? 'is-on' : ''}>
              <input type="checkbox" checked={picked.has(p.index)} onChange={() => toggle(p.index)} />
              <span>{p.label}</span>
              {p.dirty ? <em>改过</em> : null}
            </label>
          </li>
        ))}
      </ul>
      <div className="dlg-acts">
        <button type="button" className="btn is-ghost is-push" onClick={() => onConfirm('all')}>
          整份重新生成
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="btn is-primary"
          disabled={picked.size === 0}
          onClick={() => onConfirm([...picked].sort((a, b) => a - b))}
        >
          重新生成 {picked.size || ''} 页
        </button>
      </div>
    </Dialog>
  );
}
