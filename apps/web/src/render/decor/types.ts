import type { ReactNode } from 'react';
import type { CoverVariant } from '@rcs/shared';

/** 一套主题的装饰：封面一组，内容页按页码轮换几组 */
export interface DecorSet {
  cover: (variant: CoverVariant) => ReactNode;
  page: (pageNo: number) => ReactNode;
}
