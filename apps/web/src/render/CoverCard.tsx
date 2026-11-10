import type { CSSProperties, ReactNode } from 'react';
import {
  CONTENT_W,
  LAYOUT,
  PAGE_H,
  findTheme,
  unfoldNewlines,
  type CoverSpec,
  type CoverVariant,
  type DeckSettings,
  type PageOverlay,
  type SourceImage,
} from '@rcs/shared';
import { ThemeDecor } from './decor/ThemeDecor';
import { OverlayLayer, type OverlayLive } from './OverlayLayer';
import { glyphLen } from './ComponentBlock';
import { InlineField } from './edit-fields';
import { renderInline, visualWidth } from './inline';
import type { LiveEdit } from './live-edit';
import { CoverHead, PageFoot } from './PageChrome';
import { themeVars } from './theme-vars';

/**
 * 标题字号档位。短标题就该顶到最大档——「越大越轻」靠的是字号拉开，不是字重堆上去。
 * 摘要页的标题下面还要放导语、要点和数字，所以整体小两档、限两行。
 */
const TITLE_FIT = {
  poster: { sizes: [132, 120, 108, 98, 88, 80, 72], maxLines: 3, maxH: 520 },
  headline: { sizes: [124, 112, 102, 94, 86, 78, 70, 60], maxLines: 3, maxH: 600 },
  digest: { sizes: [112, 102, 94, 86, 78, 70, 62], maxLines: 2, maxH: 280 },
  checklist: { sizes: [128, 116, 104, 96, 88, 80, 72], maxLines: 3, maxH: 480 },
} as const;

/** 标题末行压一道荧光笔的变体。headline 的末行另做成色块，不重复压 */
const MARK_LAST: ReadonlySet<CoverVariant> = new Set(['poster', 'checklist']);

const TITLE_SLACK = 1.06;
/** 与 card.css 里 .cv-title 的 line-height 一致 */
const TITLE_LINE_H = 1.18;

export interface CoverCardProps {
  cover: CoverSpec;
  settings: DeckSettings;
  total: number;
  live?: LiveEdit;
  overlays?: PageOverlay[];
  overlayLive?: OverlayLive;
  images?: Map<string, SourceImage>;
}

export function CoverCard({ cover, settings, total, live, overlays, overlayLive, images }: CoverCardProps) {
  const art = cover.imageId ? images?.get(cover.imageId) : undefined;
  if (art?.url) {
    return <ArtCover image={art} settings={settings} live={live} overlays={overlays} overlayLive={overlayLive} images={images} />;
  }

  const theme = findTheme(settings.themeId);
  const variant = theme.coverVariants.includes(cover.variant) ? cover.variant : theme.coverVariants[0]!;
  const edit = coverEditor(live);
  const title = unfoldNewlines(cover.title);

  const head = <CoverHead mode={theme.mode} settings={settings} live={live} />;
  const foot = <PageFoot settings={settings} pageNo={1} total={total} live={live} />;
  const fitted = fitTitle(title, TITLE_FIT[variant]);
  const titleNode = (
    <Title
      text={variant === 'headline' ? emphasizeLastLine(title) : title}
      size={fitted.size}
      markLast={MARK_LAST.has(variant)}
      onCommit={live?.onCover && ((next) => live.onCover?.({ title: unfoldNewlines(next) }))}
      disabled={live?.disabled}
    />
  );

  return (
    <div
      className={`card cover v-${variant}${settings.marker ? '' : ' no-marker'}${live ? ' is-live' : ''}`}
      data-mode={theme.mode}
      style={themeVars(theme, settings)}
      onClick={() => {
        live?.onSelect?.(null);
        overlayLive?.onSelect?.(null);
      }}
    >
      <ThemeDecor mode={theme.mode} enabled={settings.decor} target={{ cover: variant }} />
      {head}
      <div className="cv-body">
        {edit.text('cv-kicker', cover.kicker, (kicker) => ({ kicker }), '一句引子')}
        {titleNode}
        {variant === 'poster' ? <PosterBody cover={cover} edit={edit} titleHeight={fitted.height} /> : null}
        {variant === 'digest' ? <DigestBody cover={cover} edit={edit} total={total} /> : null}
        {variant === 'checklist' ? <ChecklistBody cover={cover} edit={edit} /> : null}
        {variant === 'headline' ? (
          <>
            {edit.text('cv-lead', cover.lead, (lead) => ({ lead }), '一句话说清能得到什么', true)}
            <div className="cv-chips">{edit.list('cv-chip', cover.chips ?? [], 3, (chips) => ({ chips }))}</div>
          </>
        ) : null}
      </div>
      {foot}
      <OverlayLayer overlays={overlays ?? []} images={images ?? new Map()} live={overlayLive} />
    </div>
  );
}

/** AI 画的整张封面：字和画面都在图里，卡片上只叠装饰，不印页眉页脚 */
function ArtCover({
  image,
  settings,
  live,
  overlays,
  overlayLive,
  images,
}: Pick<CoverCardProps, 'settings' | 'live' | 'overlays' | 'overlayLive' | 'images'> & { image: SourceImage }) {
  const theme = findTheme(settings.themeId);
  return (
    <div
      className={`card cover is-art${live ? ' is-live' : ''}`}
      data-mode={theme.mode}
      style={themeVars(theme, settings)}
      onClick={() => {
        live?.onSelect?.(null);
        overlayLive?.onSelect?.(null);
      }}
    >
      <img className="cv-art" src={image.url} alt="" />
      <OverlayLayer overlays={overlays ?? []} images={images ?? new Map()} live={overlayLive} />
    </div>
  );
}

/** 瑞士封面正文区的可用高度，和 card.css 里 .card 的上下内边距、页眉页脚、.cv-body 的内边距一一对应 */
const POSTER_BODY_H = PAGE_H - LAYOUT.HEAD_TOP - LAYOUT.PAD_BOTTOM - LAYOUT.HEAD_H - LAYOUT.FOOT_GAP - LAYOUT.FOOT_H - 60;
/** 各件的估高，只用来判断放不放得下那排数字，差几像素不要紧 */
const POSTER_EST = { gap: 36, kicker: 42, flow: 230, pointRow: 80, stats: 150, breathe: 80 } as const;

/**
 * 瑞士封面：标题下面一个「从 A 到 B」的流程框，再是两栏要点。
 * 标题短、下面还空着一截时，把摘要页那排关键数字也放上来，免得封面中段空一大块
 */
function PosterBody({ cover, edit, titleHeight }: { cover: CoverSpec; edit: CoverEditor; titleHeight: number }) {
  const flow = cover.flow;
  // 从论文主题切过来的稿子只有摘要页的三行要点，拿来顶上，封面下半页才不会空着
  const points = cover.points?.length ? cover.points : (cover.facts ?? []).map((f) => f.text);
  const stats = cover.stats ?? [];
  const setFlow = (side: 'from' | 'to', patch: Partial<NonNullable<CoverSpec['flow']>['from']>) =>
    flow ? { flow: { ...flow, [side]: { ...flow[side], ...patch } } } : {};

  const { gap, kicker, pointRow, breathe } = POSTER_EST;
  const used =
    (cover.kicker ? kicker + gap : 0) +
    titleHeight +
    (flow ? POSTER_EST.flow + gap : 0) +
    (points.length ? Math.ceil(Math.min(points.length, 6) / 2) * pointRow + gap : 0);
  const showStats = stats.length >= 2 && POSTER_BODY_H - used >= POSTER_EST.stats + gap + breathe;

  return (
    <>
      {flow || showStats ? (
        <div className="cv-mid">
          {flow ? (
            <div className="cv-flow">
              <FlowNode node={flow.from} edit={edit} onPatch={(patch) => setFlow('from', patch)} />
              <span className="cv-flow-arrow">→</span>
              <FlowNode node={flow.to} edit={edit} onPatch={(patch) => setFlow('to', patch)} />
            </div>
          ) : null}
          {showStats ? <StatRow stats={stats} edit={edit} /> : null}
        </div>
      ) : null}
      {points.length ? <div className="cv-points">{edit.list('cv-point', points, 6, (next) => ({ points: next }))}</div> : null}
    </>
  );
}

type FlowNodeSpec = NonNullable<CoverSpec['flow']>['from'];

function FlowNode({
  node,
  edit,
  onPatch,
}: {
  node: FlowNodeSpec;
  edit: CoverEditor;
  onPatch: (patch: Partial<FlowNodeSpec>) => CoverPatch;
}) {
  return (
    <div className="cv-flow-node">
      {edit.text('cv-flow-title', node.title, (title) => onPatch({ title }), '环节')}
      {edit.list('cv-flow-line', node.lines, 3, (lines) => onPatch({ lines }))}
    </div>
  );
}

/** 一排关键数字。摘要页和瑞士封面共用，长相由外层封面的样式决定 */
function StatRow({ stats, edit }: { stats: NonNullable<CoverSpec['stats']>; edit: CoverEditor }) {
  const setStat = (i: number, patch: Partial<(typeof stats)[number]>) => ({
    stats: stats.map((s, j) => (j === i ? { ...s, ...patch } : s)).filter((s) => s.value.trim() || s.label.trim()),
  });
  return (
    <div className="cv-stats" data-n={Math.min(stats.length, 4)}>
      {stats.slice(0, 4).map((s, i) => (
        <div className="cv-stat" key={i}>
          {edit.text('cv-stat-value', s.value, (value) => setStat(i, { value }), '数字', false, glyphLen(s.value))}
          {edit.text('cv-stat-label', s.label, (label) => setStat(i, { label }), '说明')}
        </div>
      ))}
    </div>
  );
}

/** 论文封面：一段导语、三行「是什么 / 怎么做到 / 有什么用」、一排关键数字、一句全篇概述 */
function DigestBody({ cover, edit, total }: { cover: CoverSpec; edit: CoverEditor; total: number }) {
  // 反过来，从瑞士主题切过来的稿子只有两栏要点，按序号当作摘要行
  const facts = cover.facts?.length
    ? cover.facts
    : (cover.points ?? []).slice(0, 4).map((text, i) => ({ label: String(i + 1).padStart(2, '0'), text }));
  const stats = cover.stats ?? [];
  const setFact = (i: number, patch: Partial<(typeof facts)[number]>) => ({
    facts: facts.map((f, j) => (j === i ? { ...f, ...patch } : f)).filter((f) => f.label.trim() || f.text.trim()),
  });

  return (
    <>
      {edit.text('cv-lead', cover.lead, (lead) => ({ lead }), '一两句导语', true)}
      {facts.length ? (
        <div className="cv-facts">
          {facts.map((f, i) => (
            <div className="cv-fact" key={i}>
              {edit.text('cv-fact-label', f.label, (label) => setFact(i, { label }), '是什么')}
              {edit.text('cv-fact-text', f.text, (text) => setFact(i, { text }), '一句话')}
            </div>
          ))}
        </div>
      ) : null}
      {stats.length ? <StatRow stats={stats} edit={edit} /> : null}
      {cover.note ? (
        <div className="cv-note">
          <span>全 {total} 图 · </span>
          {edit.text('cv-note-text', stripCount(cover.note), (note) => ({ note }), '一句全篇概述')}
        </div>
      ) : null}
    </>
  );
}

/** 清单便签封面：标题和导语下面贴一张便签，列出这组卡片会讲到的几件事，每条前面一个勾 */
function ChecklistBody({ cover, edit }: { cover: CoverSpec; edit: CoverEditor }) {
  // 从摘要页切过来的稿子没有要点，拿「是什么 / 怎么做到 / 有什么用」那几行顶上
  const points = cover.points?.length ? cover.points : (cover.facts ?? []).map((f) => f.text);
  return (
    <>
      {edit.text('cv-lead', cover.lead, (lead) => ({ lead }), '一两句导语', true)}
      {points.length ? (
        <div className="cv-check" data-n={Math.min(points.length, 6)}>
          {edit.list('cv-check-item', points, 6, (next) => ({ points: next }))}
        </div>
      ) : null}
    </>
  );
}

/** 张数随分页变化，模型写的「全 12 图」往往对不上，统一去掉后由渲染按实际张数补上 */
function stripCount(note: string): string {
  return note.replace(/^\s*全\s*\d+\s*[张图页]\s*[·・|｜:：,，]?\s*/, '');
}

type CoverPatch = Partial<CoverSpec>;

interface CoverEditor {
  /** 空值在导出里直接不渲染；编辑时 placeholder 只对导语这类可以后补的字段显示 */
  text: (
    className: string,
    value: string | undefined,
    patch: (v: string) => CoverPatch,
    placeholder: string,
    multiline?: boolean,
    style?: CSSProperties,
  ) => ReactNode;
  /** 一组短条目，逐条改；改成空就删掉这一条 */
  list: (className: string, values: string[], max: number, patch: (v: string[]) => CoverPatch) => ReactNode;
}

function coverEditor(live?: LiveEdit): CoverEditor {
  const commit = (patch: CoverPatch) => live?.onCover?.(patch);
  const editable = Boolean(live?.onCover);

  return {
    text: (className, value, patch, placeholder, multiline = false, style) => {
      if (!editable) {
        return value ? (
          <div className={className} style={style}>
            {renderInline(value)}
          </div>
        ) : null;
      }
      if (!value && !multiline) return null;
      return (
        <InlineField
          className={className}
          style={style}
          value={value ?? ''}
          placeholder={placeholder}
          enterMode={multiline ? 'newline' : 'commit'}
          disabled={live?.disabled}
          onCommit={(next) => commit(patch(next.trim()))}
        />
      );
    },
    list: (className, values, max, patch) =>
      values.slice(0, max).map((v, i) =>
        editable ? (
          <InlineField
            key={i}
            className={className}
            value={v}
            enterMode="commit"
            disabled={live?.disabled}
            onCommit={(next) => {
              const copy = [...values];
              if (!next.trim()) copy.splice(i, 1);
              else copy[i] = next.trim();
              commit(patch(copy.slice(0, max)));
            }}
          />
        ) : (
          <div className={className} key={i}>
            {renderInline(v)}
          </div>
        ),
      ),
  };
}

function Title({
  text,
  size,
  markLast,
  onCommit,
  disabled,
}: {
  text: string;
  size: number;
  /** 最后一行压一道荧光笔，和内页加粗词同一种强调 */
  markLast?: boolean;
  onCommit?: (value: string) => void;
  disabled?: boolean;
}) {
  const style = { fontSize: size };
  const display = (value: string) => renderTitle(value, markLast);
  if (!onCommit) {
    return (
      <h1 className="cv-title" style={style}>
        {display(text)}
      </h1>
    );
  }
  return (
    <InlineField
      className="cv-title"
      style={style}
      value={text}
      enterMode="newline"
      disabled={disabled}
      display={display}
      onCommit={onCommit}
    />
  );
}

/** 最后一行做成色块底。已有 ** 的不重复包 */
function emphasizeLastLine(text: string): string {
  const lines = text.split('\n');
  const last = lines.length - 1;
  if (last < 1) return text;
  const line = lines[last]!.trim();
  if (!line || /^\*\*.+\*\*$/.test(line)) return text;
  lines[last] = `**${line}**`;
  return lines.join('\n');
}

function renderTitle(text: string, markLast = false) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const bar = line.trim().match(/^\*\*(.+)\*\*$/);
    if (bar) {
      return (
        <span className="cv-title-bar" key={i}>
          {bar[1]}
        </span>
      );
    }
    const content = renderInline(line);
    return (
      <span className="cv-title-line" key={i}>
        {markLast && lines.length > 1 && i === lines.length - 1 ? <span className="cv-title-mark">{content}</span> : content}
      </span>
    );
  });
}

/**
 * 标题字号自适应：按视觉宽度预估行数和总高，从最大档往下试到装得下为止。
 * 纯计算不依赖 DOM，所以编辑器预览和导出结果一致。
 * 优先选不产生自动换行的最大字号——手动断行就是最终断行，
 * 宁可小一号也不让某一行被折成孤字。
 */
function fitTitle(
  text: string,
  fit: { sizes: readonly number[]; maxLines: number; maxH: number },
): { size: number; height: number } {
  const lines = text.split('\n');
  const widths = lines.map((l) => visualWidth(l.replace(/\*\*/g, '')));
  // 估宽按每字一格算，实际还有字距和英文数字偏宽，差一点就会把最后一个字挤成孤字，所以留 6% 余量
  const wrappedAt = (size: number) =>
    widths.reduce((sum, w) => sum + Math.max(1, Math.ceil(w / (CONTENT_W / (size * TITLE_SLACK)))), 0);
  const fits = (size: number) => {
    const wrapped = wrappedAt(size);
    return wrapped <= Math.max(fit.maxLines, lines.length) && wrapped * size * 1.2 <= fit.maxH;
  };

  // 没有任何一行需要自动换行时优先采用
  const exact = fit.sizes.find((size) => fits(size) && wrappedAt(size) === lines.length);
  const size = exact ?? fit.sizes.find(fits) ?? fit.sizes[fit.sizes.length - 1]!;
  return { size, height: wrappedAt(size) * size * TITLE_LINE_H };
}
