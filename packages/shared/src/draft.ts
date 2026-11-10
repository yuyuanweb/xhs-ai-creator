import type { DraftProposal } from './types/agent.js';
import type { Deck, DeckSettings } from './types/deck.js';
import { TARGET_CARDS } from './constants/platform.js';
import { upgradeCover } from './defaults.js';
import { findAccent, findTheme } from './themes.js';

/**
 * 把一份初稿落到卡片稿上。编辑器里的 AI 和外部 Agent（Cursor 里的模型）交来的初稿都走这一处，
 * 两条路径落库后长得一样
 */
export function applyDraft(deck: Deck, proposal: DraftProposal): Deck {
  const theme = findTheme(proposal.themeId ?? deck.settings.themeId);
  const accentId = findAccent(theme, proposal.accentId).id;
  const cover = upgradeCover(proposal.cover, theme.id);

  return {
    ...deck,
    contentType: proposal.contentType,
    blocks: proposal.blocks,
    cover,
    disabledBlockIds: [],
    overlays: proposal.overlays ?? [],
    settings: clampSettings({
      ...deck.settings,
      themeId: theme.id,
      accentId,
      targetCards: proposal.targetCards,
      topic: proposal.topic ?? deck.settings.topic,
      series: proposal.series ?? deck.settings.series,
    }),
    status: 'ready',
  };
}

/** 模型偶尔会给出越界的数值，尤其是字号——全篇统一字号是硬规则，不能靠缩字号塞内容 */
export function clampSettings(s: DeckSettings): DeckSettings {
  return {
    ...s,
    fontSize: clamp(s.fontSize, 30, 46),
    imageScale: clamp(s.imageScale, 60, 100),
    targetCards: clamp(s.targetCards, 3, TARGET_CARDS.tutorial.max),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Number.isFinite(n) ? n : min, min), max);
}
