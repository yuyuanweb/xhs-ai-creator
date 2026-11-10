import type { ContentType, CoverSpec, CoverVariant, DeckSettings } from './types/deck.js';
import { TARGET_CARDS } from './constants/platform.js';
import { DEFAULT_THEME_ID, LEGACY_THEMES, findAccent, findTheme } from './themes.js';

export function defaultDeckSettings(contentType: ContentType = 'opinion'): DeckSettings {
  const theme = findTheme(DEFAULT_THEME_ID);
  return {
    themeId: theme.id,
    accentId: theme.accents[0]!.id,
    fontSize: 36,
    imageScale: 100,
    marker: true,
    showPageNumber: true,
    decor: true,
    byline: '',
    topic: '',
    series: '',
    targetCards: TARGET_CARDS[contentType].default,
  };
}

export function defaultCover(title: string): CoverSpec {
  return { title: unfoldNewlines(title), variant: findTheme(DEFAULT_THEME_ID).coverVariants[0]!, points: [] };
}

/**
 * 读出库里的设置时统一过一遍：旧主题 id 落到新主题上，页脚昵称并进署名，已废弃的尾页字段丢掉，缺的字段补默认值。
 * 放在读取入口做一次，渲染和编辑就不用到处兼容老数据。
 */
export function upgradeSettings(raw: unknown): DeckSettings {
  const base = defaultDeckSettings();
  const s = (raw ?? {}) as Partial<DeckSettings> & { footerName?: string; showOutro?: boolean; outroLines?: string[] };
  const legacy = s.themeId ? LEGACY_THEMES[s.themeId] : undefined;
  const theme = findTheme(legacy?.themeId ?? s.themeId ?? base.themeId);

  const { footerName, showOutro: _showOutro, outroLines: _outroLines, ...rest } = s;
  return {
    ...base,
    ...rest,
    themeId: theme.id,
    accentId: findAccent(theme, legacy?.accentId ?? s.accentId).id,
    byline: s.byline ?? footerName ?? '',
  };
}

/** 封面变体跟着主题走：旧变体或别的主题的专属封面，一律换成当前主题的专属封面 */
export function upgradeCover(raw: unknown, themeId: string): CoverSpec {
  const c = (raw ?? {}) as Partial<CoverSpec> & { variant?: string };
  const theme = findTheme(themeId);
  const variant = theme.coverVariants.includes(c.variant as CoverVariant)
    ? (c.variant as CoverVariant)
    : theme.coverVariants[0]!;
  return { ...c, title: c.title ?? '', variant };
}

/** 模型常把换行写成字面量 \\n，渲染前收成真正的换行 */
export function unfoldNewlines(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
