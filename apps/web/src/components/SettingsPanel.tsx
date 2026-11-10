import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  THEMES,
  findAccent,
  findTheme,
  type CoverVariant,
  type Deck,
  type DeckSettings,
  type Theme,
  type ThemeAccent,
} from '@rcs/shared';

const COVER_LABELS: Record<CoverVariant, string> = {
  poster: '流程海报',
  digest: '摘要页',
  checklist: '清单便签',
  headline: '大标题',
};

/** 页眉页脚上的三处文字。署名跟人走，话题和系列名跟这一篇走 */
const CHROME_FIELDS: Array<{ key: 'byline' | 'topic' | 'series'; label: string }> = [
  { key: 'byline', label: '署名 / 栏目' },
  { key: 'topic', label: '话题' },
  { key: 'series', label: '系列名 / 副标题' },
];

export function SettingsPanel({
  deck,
  updateDeck,
  disabled,
}: {
  deck: Deck;
  updateDeck: (updater: (prev: Deck) => Deck) => void;
  disabled: boolean;
}) {
  const s = deck.settings;
  const theme = findTheme(s.themeId);
  const accent = findAccent(theme, s.accentId);

  const set = (patch: Partial<DeckSettings>) =>
    updateDeck((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));

  // 换主题时封面跟着换成新主题的专属封面，强调色落回新主题的默认色
  const pickTheme = (next: Theme) => {
    if (next.id === theme.id) return;
    updateDeck((prev) => ({
      ...prev,
      settings: { ...prev.settings, themeId: next.id, accentId: next.accents[0]!.id },
      cover: { ...prev.cover, variant: next.coverVariants.includes(prev.cover.variant) ? prev.cover.variant : next.coverVariants[0]! },
    }));
  };

  return (
    <div className="style-sheet" aria-disabled={disabled}>
      <section>
        <h2>主题</h2>
        <div className="theme-row">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`theme-card${item.id === theme.id ? ' is-on' : ''}`}
              style={{ background: item.tokens.bg, color: item.tokens.heading }}
              title={item.description}
              disabled={disabled}
              onClick={() => pickTheme(item)}
            >
              <ThemeSample theme={item} accent={item.id === theme.id ? accent : item.accents[0]!} />
              <span className="theme-name" style={{ fontFamily: item.tokens.headingFont }}>
                {item.name}
              </span>
            </button>
          ))}
        </div>
        <div className="accent-row">
          {theme.accents.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`accent-pick${a.id === accent.id ? ' is-on' : ''}`}
              disabled={disabled}
              onClick={() => set({ accentId: a.id })}
            >
              <i style={{ background: a.accent }} />
              <span>{a.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>封面</h2>
        <div className="cover-row">
          {theme.coverVariants.map((variant) => (
            <button
              key={variant}
              type="button"
              className={`cover-pick${deck.cover.variant === variant ? ' is-on' : ''}`}
              disabled={disabled}
              onClick={() => updateDeck((prev) => ({ ...prev, cover: { ...prev.cover, variant } }))}
            >
              <CoverGlyph variant={variant} theme={theme} accent={accent} />
              <span>{COVER_LABELS[variant]}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>页眉页脚</h2>
        <div className="field-list">
          {CHROME_FIELDS.map((f) => (
            <label key={f.key}>
              <span>{f.label}</span>
              <input
                className="nick-field"
                value={s[f.key]}
                disabled={disabled}
                onChange={(e) => set({ [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2>字号</h2>
        <Tune
          min={30}
          max={46}
          value={s.fontSize}
          disabled={disabled}
          suffix="px"
          onChange={(fontSize) => set({ fontSize })}
          preview={
            <em
              className="tune-glyph"
              style={{ fontSize: 14 + (s.fontSize - 30) * 0.7, fontFamily: theme.tokens.headingFont, fontWeight: 500 }}
            >
              永
            </em>
          }
        />
      </section>

      <section>
        <h2>配图</h2>
        <Tune
          min={60}
          max={100}
          value={s.imageScale}
          disabled={disabled}
          suffix="%"
          onChange={(imageScale) => set({ imageScale })}
          preview={
            <span className="tune-bar">
              <i style={{ width: `${s.imageScale}%`, background: accent.accent }} />
            </span>
          }
        />
      </section>

      <section className="switch-list">
        <Switch
          on={s.marker}
          disabled={disabled}
          onChange={(marker) => set({ marker })}
          label="荧光笔"
          sample={
            <span className="swatch" style={{ background: theme.tokens.bg }}>
              <mark style={{ background: accent.marker, color: theme.tokens.heading }}>重点</mark>
            </span>
          }
        />
        <Switch on={s.decor} disabled={disabled} onChange={(decor) => set({ decor })} label="装饰图形" />
        <Switch on={s.showPageNumber} disabled={disabled} onChange={(showPageNumber) => set({ showPageNumber })} label="页码" />
      </section>
    </div>
  );
}

/**
 * 主题卡上的小样，各取主题最有辨识度的一笔：瑞士是粗线加色块，论文是衬线字加主色竖线，
 * 手帐是一截胶带压着便签，暗夜是终端的三颗圆点加一道发光的光标，波普是描黑边、投硬影的色块
 */
function ThemeSample({ theme, accent }: { theme: Theme; accent: ThemeAccent }) {
  const { heading, divider, warn, surface } = theme.tokens;
  switch (theme.mode) {
    case 'paper':
      return (
        <span className="theme-sample is-paper">
          <b style={{ borderColor: divider, fontFamily: theme.tokens.headingFont }}>Aa</b>
          <i style={{ background: accent.accent }} />
          <i style={{ background: warn }} />
        </span>
      );
    case 'memo':
      return (
        <span className="theme-sample is-memo">
          <b style={{ background: surface }} />
          <i style={{ background: accent.accent }} />
        </span>
      );
    case 'neon':
      return (
        <span className="theme-sample is-neon">
          <em />
          <i style={{ background: accent.accent, boxShadow: `0 0 8px ${accent.accent}` }} />
        </span>
      );
    case 'pop':
      return (
        <span className="theme-sample is-pop" style={{ color: heading }}>
          <i style={{ background: accent.accent }} />
          <i style={{ background: surface }} />
        </span>
      );
    default:
      return (
        <span className="theme-sample is-swiss">
          <em style={{ background: heading }} />
          <i style={{ background: accent.accent }} />
          <i style={{ background: heading }} />
        </span>
      );
  }
}

function CoverGlyph({ variant, theme, accent }: { variant: CoverVariant; theme: Theme; accent: ThemeAccent }) {
  const { bg, heading, muted, warn, divider, surface } = theme.tokens;

  if (variant === 'poster') {
    return (
      <span className="glyph v-poster" style={{ background: bg }}>
        <em style={{ background: heading }} />
        <b style={{ background: heading, width: '82%' }} />
        <b style={{ background: accent.accent, width: '64%' }} />
        <span className="glyph-box" style={{ background: `linear-gradient(90deg, ${surface} 50%, ${accent.accent} 50%)` }} />
        <span className="glyph-cols">
          <b style={{ background: muted }} />
          <b style={{ background: muted }} />
        </span>
      </span>
    );
  }

  if (variant === 'digest') {
    return (
      <span className="glyph v-digest" style={{ background: bg }}>
        <i style={{ background: warn }} />
        <b style={{ background: heading, width: '70%' }} />
        <b style={{ background: muted, width: '90%', opacity: 0.5 }} />
        <span className="glyph-rule" style={{ background: divider }} />
        <span className="glyph-cols is-stats">
          <b style={{ background: accent.accent }} />
          <b style={{ background: accent.accent }} />
          <b style={{ background: warn }} />
        </span>
      </span>
    );
  }

  if (variant === 'checklist') {
    const row = `linear-gradient(90deg, ${accent.accent} 0 5px, transparent 5px 8px, ${muted} 8px)`;
    return (
      <span className="glyph v-checklist" style={{ background: bg }}>
        <i style={{ background: accent.accent }} />
        <b style={{ background: heading, width: '84%' }} />
        <b style={{ background: heading, width: '64%' }} />
        <span className="glyph-check" style={{ background: surface }}>
          <b style={{ background: row }} />
          <b style={{ background: row }} />
          <b style={{ background: row }} />
        </span>
      </span>
    );
  }

  return (
    <span className="glyph v-headline" style={{ background: bg }}>
      <i style={{ background: accent.accent }} />
      <b style={{ background: heading, width: '90%' }} />
      <b style={{ background: heading, width: '70%' }} />
      <b style={{ background: accent.accent, width: '54%' }} />
    </span>
  );
}

function Switch({
  on,
  label,
  sample,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  sample?: ReactNode;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button type="button" className="switch-row" disabled={disabled} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span>
        {label}
        {sample}
      </span>
      <i className={on ? 'is-on' : ''} />
    </button>
  );
}

function Tune({
  min,
  max,
  value,
  suffix,
  disabled,
  preview,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  suffix: string;
  disabled: boolean;
  preview: ReactNode;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ratio = (clamp(value, min, max) - min) / (max - min);

  const pick = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(Math.round(min + t * (max - min)));
  };

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pick(e.clientX);
  };

  return (
    <div className="tune">
      <div className="tune-head">
        {preview}
        <b>
          {value}
          {suffix}
        </b>
      </div>
      <div className="tune-line">
        <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="减小">
          −
        </button>
        <div
          className="tune-track"
          ref={trackRef}
          onPointerDown={drag}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX);
          }}
        >
          <i style={{ width: `${ratio * 100}%` }} />
          <span style={{ left: `${ratio * 100}%` }} />
        </div>
        <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="增大">
          +
        </button>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
