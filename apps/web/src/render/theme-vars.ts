import type { CSSProperties } from 'react';
import { IMAGE_MAX_H, findAccent, type DeckSettings, type Theme } from '@rcs/shared';

/**
 * 主题令牌和选中的强调色全部以 CSS 变量注入卡片根节点，
 * 所以增加一套主题或一种强调色不需要改任何渲染组件，也不会出现封面和内页各用一套配色的割裂。
 */
export function themeVars(theme: Theme, settings: DeckSettings): CSSProperties {
  const t = theme.tokens;
  const a = findAccent(theme, settings.accentId);
  return {
    '--bg': t.bg,
    '--surface': t.surface,
    '--text': t.text,
    '--heading': t.heading,
    '--muted': t.muted,
    '--warn': t.warn,
    '--accent': a.accent,
    '--accent-ink': a.accentInk ?? a.accent,
    '--marker': a.marker,
    '--on-accent': a.onAccent,
    '--divider': t.divider,
    '--code-bg': t.codeBg,
    '--code-text': t.codeText,
    '--img-radius': t.imageRadius,
    '--img-border': t.imageBorder,
    '--body-font': t.bodyFont,
    '--heading-font': t.headingFont,
    '--code-font': t.codeFont,
    '--heading-weight': t.headingWeight,
    '--display-weight': t.displayWeight,
    '--display-tracking': t.displayTracking,
    '--fs': `${settings.fontSize}px`,
    '--img-w': `${settings.imageScale}%`,
    '--img-max-h': `${IMAGE_MAX_H}px`,
  } as CSSProperties;
}
