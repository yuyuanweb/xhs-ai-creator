import { MIN_FILL } from '@rcs/shared';

/** 页面的版面状态：装不下和偏空要一眼看到，正常的只淡淡标个填充率 */
export function PageTag({ fill, overflow }: { fill: number; overflow?: boolean }) {
  if (overflow) return <span className="tag is-bad">装不下</span>;
  const pct = `${Math.round(fill * 100)}%`;
  if (fill < MIN_FILL) return <span className="tag is-warn">偏空 {pct}</span>;
  return <span className="page-fill">填充 {pct}</span>;
}

export function pageLabel(index: number): string {
  return index === 0 ? '封面' : `第 ${index + 1} 张`;
}
