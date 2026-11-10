import type { CardBlock, CoverSpec, DeckSettings } from '@rcs/shared';

/** 只挂在编辑用的那张卡片上。导出用的卡片不传，DOM 保持干净。 */
export interface LiveEdit {
  disabled?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onText?: (id: string, text: string) => void;
  onItems?: (id: string, items: string[]) => void;
  onCode?: (id: string, code: string) => void;
  onPatch?: (id: string, patch: Partial<CardBlock>) => void;
  onCover?: (patch: Partial<CoverSpec>) => void;
  /** 署名、话题、系列名这类全篇共用的页眉页脚文字 */
  onSettings?: (patch: Partial<DeckSettings>) => void;
}
