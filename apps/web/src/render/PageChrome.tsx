import type { ReactNode } from 'react';
import type { DeckSettings, ThemeMode } from '@rcs/shared';
import { InlineField } from './edit-fields';
import type { LiveEdit } from './live-edit';

type ChromeKey = 'byline' | 'topic' | 'series';

/** 页眉页脚上的一处文字。可编辑时直接改设置项，所有页一起变；没填就空着，不拿别的内容顶上 */
function ChromeText({ field, settings, className, live }: { field: ChromeKey; settings: DeckSettings; className: string; live?: LiveEdit }) {
  const value = settings[field];
  if (live?.onSettings) {
    return (
      <InlineField
        className={className}
        value={value}
        enterMode="commit"
        disabled={live.disabled}
        onCommit={(next) => live.onSettings?.({ [field]: next.trim() })}
      />
    );
  }
  return <span className={className}>{value}</span>;
}

/**
 * 页眉。两套主题的页眉承担的职责不同：
 * 瑞士每页一样，左署名右话题，像杂志的栏头；论文每页在变，左章节名右 § 编号，像论文的节号。
 */
export function PageHead({
  mode,
  settings,
  section,
  chapter,
  continued,
  live,
}: {
  mode: ThemeMode;
  settings: DeckSettings;
  section: string;
  chapter?: number;
  continued?: boolean;
  live?: LiveEdit;
}) {
  if (mode === 'paper') {
    return (
      <div className="c-head">
        <span className="c-section">
          {section}
          {continued ? <em className="c-cont">续</em> : null}
        </span>
        {chapter !== undefined ? <span className="c-chapter">§{chapter}</span> : null}
      </div>
    );
  }
  return (
    <div className="c-head">
      <ChromeText field="byline" settings={settings} className="c-byline" live={live} />
      <ChromeText field="topic" settings={settings} className="c-topic" live={live} />
    </div>
  );
}

/** 封面的页眉：论文封面左边放话题、右边是 §0，瑞士封面和内页一样 */
export function CoverHead({ mode, settings, live }: { mode: ThemeMode; settings: DeckSettings; live?: LiveEdit }) {
  if (mode === 'paper') {
    return (
      <div className="c-head">
        <ChromeText field="topic" settings={settings} className="c-section" live={live} />
        <span className="c-chapter">§0</span>
      </div>
    );
  }
  return <PageHead mode={mode} settings={settings} section="" live={live} />;
}

export function PageFoot({
  settings,
  pageNo,
  total,
  live,
  extra,
}: {
  settings: DeckSettings;
  pageNo: number;
  total: number;
  live?: LiveEdit;
  extra?: ReactNode;
}) {
  return (
    <div className="c-foot">
      <ChromeText field="series" settings={settings} className="c-series" live={live} />
      {extra}
      <span className="c-page">
        {settings.showPageNumber ? `${String(pageNo).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : ''}
      </span>
    </div>
  );
}
