import type { CoverVariant, ThemeMode } from '@rcs/shared';
import { memoDecor } from './memo';
import { neonDecor } from './neon';
import { paperDecor } from './paper';
import { popDecor } from './pop';
import { swissDecor } from './swiss';
import type { DecorSet } from './types';

const DECOR: Record<ThemeMode, DecorSet> = {
  swiss: swissDecor,
  paper: paperDecor,
  memo: memoDecor,
  neon: neonDecor,
  pop: popDecor,
};

export type DecorTarget = { cover: CoverVariant } | { pageNo: number };

/**
 * 主题自带的装饰图形，垫在页眉、正文、页脚下面一层。
 * 只画在页边、角落和页眉上方的留白里，压到正文的部分要么很淡、要么被组件的底色盖住；
 * 不参与测高，开关它不会让分页变化。
 */
export function ThemeDecor({ mode, enabled, target }: { mode: ThemeMode; enabled: boolean; target: DecorTarget }) {
  if (!enabled) return null;
  const set = DECOR[mode];
  return <div className="c-decor">{'cover' in target ? set.cover(target.cover) : set.page(target.pageNo)}</div>;
}
