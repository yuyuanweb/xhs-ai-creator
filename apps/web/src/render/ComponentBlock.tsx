import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { chartValue, type BlockEntry, type CardBlock } from '@rcs/shared';
import { InlineField } from './edit-fields';
import { renderInline, visualWidth } from './inline';

/** 组件块的编辑回调：组件里任何一处文字改完，都整块回写一份新的字段 */
export interface ComponentLive {
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onPatch?: (patch: Partial<CardBlock>) => void;
}

/**
 * 七种组件块：序号行、大数字、卡片组、提示框、表格、流程图、条形图。
 * 结构在这里，长相全在 card.css 里按主题区分——同一个序号行在瑞士里是细字大序号，在论文里是色块圆点。
 */
export function ComponentBlock({ block: b, live }: { block: CardBlock; live?: ComponentLive }) {
  const editable = Boolean(live?.onPatch);
  const on = live?.selected ? ' is-on' : '';
  const field = fieldFactory(live);

  const entries = b.entries ?? [];
  const setEntry = (i: number, key: keyof BlockEntry, value: string) => {
    const next = entries.map((e, j) => (j === i ? { ...e, [key]: value.trim() } : e));
    // 一项里的字全删空了，就当作删掉这一项
    live?.onPatch?.({ entries: next.filter((e) => Object.values(e).some((v) => v?.trim())) });
  };

  switch (b.kind) {
    case 'steps': {
      const marker = b.marker ?? 'number';
      return (
        <ol className={`b-steps m-${marker}${on}`} onClick={stop(editable)}>
          {entries.map((e, i) => (
            <li className="b-step" key={i}>
              <span className="b-step-no">{marker === 'arrow' ? '↳' : String(i + 1).padStart(2, '0')}</span>
              <div className="b-step-body">
                {field('b-step-title', e.title, (v) => setEntry(i, 'title', v), { placeholder: '要点' })}
                {e.text || editable ? field('b-step-text', e.text, (v) => setEntry(i, 'text', v), { multiline: true, placeholder: '一两句说明' }) : null}
              </div>
            </li>
          ))}
        </ol>
      );
    }

    case 'stats':
      return (
        <div className={`b-stats${on}`} data-n={Math.min(entries.length, 4)} onClick={stop(editable)}>
          {entries.map((e, i) => (
            <div className="b-stat" key={i}>
              {e.label || editable ? field('b-stat-label', e.label, (v) => setEntry(i, 'label', v), { placeholder: '对象' }) : null}
              {field('b-stat-value', e.value, (v) => setEntry(i, 'value', v), { placeholder: '数字', style: glyphLen(e.value) })}
              {e.text || editable ? field('b-stat-text', e.text, (v) => setEntry(i, 'text', v), { multiline: true, placeholder: '说明' }) : null}
            </div>
          ))}
        </div>
      );

    case 'cards':
      return (
        <div className={`b-cards${on}`} data-cols={columnsOf(entries.length)} onClick={stop(editable)}>
          {entries.map((e, i) => (
            <div className={`b-card${i === b.highlight ? ' is-hl' : ''}`} key={i}>
              {e.label || editable ? field('b-card-label', e.label, (v) => setEntry(i, 'label', v), { placeholder: '标签' }) : null}
              {field('b-card-title', e.title, (v) => setEntry(i, 'title', v), { placeholder: '标题' })}
              {e.text || editable ? field('b-card-text', e.text, (v) => setEntry(i, 'text', v), { multiline: true, placeholder: '说明' }) : null}
            </div>
          ))}
        </div>
      );

    case 'callout':
      return (
        <div className={`b-callout t-${b.tone ?? 'accent'}${on}`} onClick={stop(editable)}>
          {b.label ? field('b-callout-label', b.label, (v) => live?.onPatch?.({ label: v.trim() })) : null}
          {field('b-callout-text', b.text, (v) => live?.onPatch?.({ text: v }), { multiline: true, placeholder: '一句结论' })}
        </div>
      );

    case 'table': {
      const rows = b.rows ?? [];
      const width = Math.max(0, ...rows.map((r) => r.length));
      const setCell = (r: number, c: number, value: string) => {
        const next = rows.map((row, i) => (i === r ? Array.from({ length: width }, (_, j) => (j === c ? value.trim() : row[j] ?? '')) : row));
        live?.onPatch?.({ rows: next });
      };
      const [head, ...body] = rows;
      return (
        <table className={`b-table${on}`} onClick={stop(editable)}>
          {head ? (
            <thead>
              <tr>
                {Array.from({ length: width }, (_, c) => (
                  <th key={c}>{field('b-cell', head[c], (v) => setCell(0, c, v))}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: width }, (_, c) => (
                  <td key={c}>{field('b-cell', row[c], (v) => setCell(r + 1, c, v))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    case 'flow': {
      const dir = flowDirection(entries.length);
      return (
        <div className={`b-flow d-${dir}${on}`} onClick={stop(editable)}>
          {entries.map((e, i) => (
            <Fragment key={i}>
              {i > 0 ? <FlowArrow dir={dir} /> : null}
              <div className={`b-flow-node${i === b.highlight ? ' is-hl' : ''}`}>
                <span className="b-flow-no">{String(i + 1).padStart(2, '0')}</span>
                <div className="b-flow-body">
                  {field('b-flow-title', e.title, (v) => setEntry(i, 'title', v), { placeholder: '环节' })}
                  {e.text || editable ? field('b-flow-text', e.text, (v) => setEntry(i, 'text', v), { multiline: true, placeholder: '一句说明' }) : null}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      );
    }

    case 'chart': {
      const values = entries.map((e) => chartValue(e.value) ?? 0);
      const max = Math.max(0, ...values) || 1;
      const hl = b.highlight !== undefined ? ' has-hl' : '';
      return (
        <div className={`b-chart${hl}${on}`} onClick={stop(editable)}>
          {b.label || editable ? field('b-chart-title', b.label, (v) => live?.onPatch?.({ label: v.trim() || undefined }), { placeholder: '图题' }) : null}
          {entries.map((e, i) => (
            <div className={`b-bar${i === b.highlight ? ' is-hl' : ''}`} key={i}>
              <div className="b-bar-head">
                {field('b-bar-label', e.label, (v) => setEntry(i, 'label', v), { placeholder: '对象' })}
                {e.text || editable ? field('b-bar-text', e.text, (v) => setEntry(i, 'text', v), { placeholder: '补充' }) : null}
              </div>
              <div className="b-bar-track">
                <i className="b-bar-fill" style={{ width: `${Math.max(2, (values[i]! / max) * BAR_MAX_PCT)}%` }} />
                {field('b-bar-value', e.value, (v) => setEntry(i, 'value', v), { placeholder: '数字' })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

/** 最长的那根条只占轨道的这么多，剩下的位置留给条尾的数字 */
const BAR_MAX_PCT = 74;

/** 四步以内横着排，一眼看完从左到右；再多一行装不下，竖着往下走 */
function flowDirection(n: number): 'row' | 'col' {
  return n <= 4 ? 'row' : 'col';
}

function FlowArrow({ dir }: { dir: 'row' | 'col' }) {
  return dir === 'row' ? (
    <svg className="b-flow-arrow" viewBox="0 0 32 24" aria-hidden>
      <path d="M2 12h26M20 4l8 8-8 8" />
    </svg>
  ) : (
    <svg className="b-flow-arrow" viewBox="0 0 24 32" aria-hidden>
      <path d="M12 2v26M4 20l8 8 8-8" />
    </svg>
  );
}

/** 卡片数决定列数：两张并排对照，三张一排，四张排成田字，再多就三列往下排 */
function columnsOf(n: number): number {
  if (n <= 2) return 2;
  if (n === 4) return 2;
  return 3;
}

function stop(editable: boolean) {
  return editable ? (e: { stopPropagation: () => void }) => e.stopPropagation() : undefined;
}

interface FieldOptions {
  multiline?: boolean;
  placeholder?: string;
  style?: CSSProperties;
}

/** 大数字按字宽收缩字号，CSS 里拿 --len 除格子宽度 */
export function glyphLen(value: string | undefined): CSSProperties {
  return { '--len': Math.max(1, visualWidth(value ?? '') * 1.1) } as CSSProperties;
}

/** 可编辑时每处文字都是一个就地输入框，导出时是普通文本。两种形态共用一个 className，长相完全一致 */
function fieldFactory(live?: ComponentLive) {
  return (className: string, value: string | undefined, onCommit: (v: string) => void, opts: FieldOptions = {}): ReactNode => {
    if (!live?.onPatch) {
      return (
        <div className={className} style={opts.style}>
          {renderInline(value ?? '')}
        </div>
      );
    }
    return (
      <InlineField
        className={className}
        style={opts.style}
        value={value ?? ''}
        placeholder={opts.placeholder}
        enterMode={opts.multiline ? 'newline' : 'commit'}
        disabled={live.disabled}
        onSelect={live.onSelect}
        onCommit={onCommit}
      />
    );
  };
}
