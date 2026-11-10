import type { ReactNode } from 'react';
import {
  MIN_FILL,
  type BlockEntry,
  type BreakHint,
  type CalloutTone,
  type CardBlock,
  type CardBlockKind,
  type CoverSpec,
  type Deck,
  type OverlayKind,
  type SourceArticle,
  type SourceImage,
} from '@rcs/shared';
import { DECOR_EMOJIS, DECOR_ICONS, isUploadImage } from '@rcs/shared';
import { plainText } from '../../render/inline';
import { Icon, type IconName } from '../../ui/icons';
import { SettingsPanel } from '../SettingsPanel';
import { AgentLockNote } from './AgentStatus';

export type InspectorTab = 'style' | 'page' | 'stuff';

export interface PageContext {
  /** 当前第几张，0 是封面 */
  index: number;
  label: string;
  /** 本页所属章节，封面没有 */
  section?: string;
  /** 本页按顺序排的块 */
  blockIds: string[];
  fill?: number;
  overflow?: boolean;
  isCover: boolean;
  selected?: CardBlock;
  /** 选中块在本页的位置，0 表示是本页第一块 */
  selectedPos: number;
  canJoin: boolean;
}

export interface InspectorActions {
  onSelect: (id: string) => void;
  onHint: (id: string, hint: BreakHint | null) => void;
  onToggleOff: (id: string, off: boolean) => void;
  onCover: (patch: Partial<Deck['cover']>) => void;
  onImage: (id: string, imageId: string) => void;
  onPatch: (id: string, patch: Partial<CardBlock>) => void;
  onDeletePage?: () => void;
  onAddOverlay?: (partial: { kind: OverlayKind; emoji?: string; icon?: string; imageId?: string }) => void;
  onUpload?: (file: File) => Promise<SourceArticle | void>;
}

const PANEL_TITLES: Record<InspectorTab, { title: string; sub: string }> = {
  page: { title: '本页', sub: '版面状态、内容块和分页' },
  style: { title: '样式', sub: '整份稿子共用的主题和版式' },
  stuff: { title: '素材', sub: '贴纸、图标和自己上传的图' },
};

export function Inspector({
  tab,
  deck,
  updateDeck,
  disabled,
  page,
  images,
  actions,
  layoutBlocks,
}: {
  tab: InspectorTab;
  deck: Deck;
  updateDeck: (updater: (prev: Deck) => Deck) => void;
  disabled: boolean;
  page: PageContext;
  images: SourceImage[];
  actions: InspectorActions;
  layoutBlocks: Map<string, CardBlock>;
}) {
  const head = PANEL_TITLES[tab];
  return (
    <aside className="st-panel">
      <header className="st-panel-head">
        <h2>{head.title}</h2>
        <span>{head.sub}</span>
      </header>

      <div className="st-panel-body">
        {disabled ? <AgentLockNote /> : null}
        {tab === 'style' ? (
          <SettingsPanel deck={deck} updateDeck={updateDeck} disabled={disabled} />
        ) : tab === 'stuff' ? (
          <StuffTab images={images} disabled={disabled} actions={actions} />
        ) : (
          <PageTab deck={deck} disabled={disabled} page={page} images={images} actions={actions} layoutBlocks={layoutBlocks} />
        )}
      </div>
    </aside>
  );
}

function PageTab({
  deck,
  disabled,
  page,
  images,
  actions,
  layoutBlocks,
}: {
  deck: Deck;
  disabled: boolean;
  page: PageContext;
  images: SourceImage[];
  actions: InspectorActions;
  layoutBlocks: Map<string, CardBlock>;
}) {
  const { selected } = page;
  const blocks = page.blockIds.map((id) => layoutBlocks.get(id)).filter((b): b is CardBlock => Boolean(b));

  return (
    <div className="pane" aria-disabled={disabled}>
      <section className="page-card">
        <div className="page-card-head">
          <b>{page.label}</b>
          {page.section ? <span title={page.section}>{page.section}</span> : null}
        </div>
        {page.fill !== undefined ? (
          <PageHealth fill={page.fill} overflow={page.overflow} />
        ) : (
          <p className="pane-hint">
            封面上的字都能点开直接改，改成空就去掉这一项。
          </p>
        )}
      </section>

      {page.isCover ? (
        <section className="pane-sec">
          <h3>封面元素</h3>
          <div className="pane-acts">
            {coverAdds(deck.cover).map(([label, patch]) => (
              <Act key={label} icon={label.startsWith('去掉') ? 'minus' : 'plus'} disabled={disabled} onClick={() => actions.onCover(patch)}>
                {label}
              </Act>
            ))}
          </div>
        </section>
      ) : null}

      {blocks.length ? (
        <section className="pane-sec">
          <h3>
            本页内容 <span className="pane-count">{blocks.length}</span>
          </h3>
          <ul className="blk-list">
            {blocks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={selected?.id === b.id ? 'is-on' : ''}
                  disabled={disabled}
                  onClick={() => actions.onSelect(b.id)}
                >
                  <span className="blk-kind">
                    <Icon name={KIND_ICONS[b.kind]} size={14} />
                  </span>
                  <span className="blk-text">
                    <b>{KIND_LABELS[b.kind]}</b>
                    <span>{previewOf(b) || '（空）'}</span>
                  </span>
                  {b.breakHint ? <em>{b.breakHint === 'break' ? '另起' : '并入'}</em> : null}
                </button>
              </li>
            ))}
          </ul>
          {!selected ? <p className="pane-hint">点卡片上的文字可以直接改；在这里或卡片上选中一块，就能调整分页和结构。</p> : null}
        </section>
      ) : null}

      {selected ? (
        <section className="pane-sec sel-sec">
          <h3>
            选中的块
            <span className="sel-kind">
              <Icon name={KIND_ICONS[selected.kind]} size={12} />
              {KIND_LABELS[selected.kind]}
            </span>
          </h3>
          <div className="pane-acts">
            {page.selectedPos > 0 ? (
              <Act icon="split" disabled={disabled} onClick={() => actions.onHint(selected.id, 'break')}>
                从这里另起一页
              </Act>
            ) : null}
            {page.canJoin ? (
              <Act icon="merge" disabled={disabled} onClick={() => actions.onHint(selected.id, 'join')}>
                并入上一页
              </Act>
            ) : null}
            {selected.breakHint ? (
              <Act icon="reset" disabled={disabled} onClick={() => actions.onHint(selected.id, null)}>
                取消分页
              </Act>
            ) : null}
            <Act icon="hide" disabled={disabled} onClick={() => actions.onToggleOff(selected.id, true)}>
              隐藏这块
            </Act>
          </div>
          {selected.kind === 'image' ? (
            <ImagePicks
              images={images}
              selectedId={selected.imageId}
              onPick={(id) => actions.onImage(selected.id, id)}
            />
          ) : null}
          <ComponentActions block={selected} disabled={disabled} onPatch={(patch) => actions.onPatch(selected.id, patch)} />
        </section>
      ) : null}

      {deck.disabledBlockIds.length > 0 ? (
        <section className="pane-sec">
          <h3>
            已隐藏 <span className="pane-count">{deck.disabledBlockIds.length}</span>
          </h3>
          <ul className="blk-list is-off">
            {deck.disabledBlockIds.map((id) => {
              const block = layoutBlocks.get(id);
              if (!block) return null;
              return (
                <li key={id}>
                  <button type="button" disabled={disabled} onClick={() => actions.onToggleOff(id, false)} title="恢复显示">
                    <span className="blk-kind">
                      <Icon name={KIND_ICONS[block.kind]} size={14} />
                    </span>
                    <span className="blk-text">
                      <b>{KIND_LABELS[block.kind]}</b>
                      <span>{previewOf(block) || '（空）'}</span>
                    </span>
                    <Icon name="show" size={15} className="blk-restore" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!page.isCover && actions.onDeletePage ? (
        <section className="pane-sec">
          <Act icon="trash" danger disabled={disabled} onClick={actions.onDeletePage}>
            删除这一页
          </Act>
        </section>
      ) : null}
    </div>
  );
}

/** 版面体检：填充率条 + 一句该怎么改。低于合格线的位置标出来，比一个百分数更容易判断 */
function PageHealth({ fill, overflow }: { fill: number; overflow?: boolean }) {
  const pct = Math.round(fill * 100);
  const state = overflow ? 'is-over' : fill < MIN_FILL ? 'is-thin' : 'is-ok';
  const advice = overflow
    ? '内容装不下：删减文字，或把后面的块另起一页。'
    : fill < MIN_FILL
      ? '这一页偏空：补充一些内容，或把它并入上一页。'
      : '版面饱满，不用调整。';

  return (
    <div className={`health ${state}`}>
      <div className="meter">
        <div className="meter-track">
          <i style={{ width: `${Math.min(100, pct)}%` }} />
          <em style={{ left: `${MIN_FILL * 100}%` }} />
        </div>
        <span>{overflow ? '装不下' : `${pct}%`}</span>
      </div>
      <p>
        <Icon name={state === 'is-ok' ? 'checkCircle' : 'warn'} size={14} />
        {advice}
      </p>
    </div>
  );
}

function Act({
  children,
  icon,
  danger,
  disabled,
  onClick,
}: {
  children: ReactNode;
  icon?: IconName;
  danger?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`act${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

function StuffTab({
  images,
  disabled,
  actions,
}: {
  images: SourceImage[];
  disabled: boolean;
  actions: InspectorActions;
}) {
  const uploaded = images.filter(isUploadImage);

  return (
    <div className="pane" aria-disabled={disabled}>
      <section className="pane-sec">
        <h3>素材库</h3>
        <p className="pane-hint">点一下放到当前页，或拖到卡片上。装饰浮在页面上，不挤占正文。</p>
      </section>
      <section className="pane-sec">
        <h3>小表情</h3>
        <div className="stuff-grid">
          {DECOR_EMOJIS.map((item) => (
            <DecorBtn
              key={item.id}
              disabled={disabled}
              title={item.label}
              payload={{ kind: 'emoji', emoji: item.emoji }}
              onAdd={actions.onAddOverlay}
            >
              {item.emoji}
            </DecorBtn>
          ))}
        </div>
      </section>
      <section className="pane-sec">
        <h3>图标</h3>
        <div className="stuff-grid">
          {DECOR_ICONS.map((item) => (
            <DecorBtn
              key={item.id}
              disabled={disabled}
              title={item.label}
              payload={{ kind: 'icon', icon: item.id }}
              onAdd={actions.onAddOverlay}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={item.path} />
              </svg>
            </DecorBtn>
          ))}
        </div>
      </section>
      <section className="pane-sec">
        <h3>上传的图</h3>
        <div className="pane-acts">
          <label className={`act is-upload${disabled ? ' is-off' : ''}`}>
            <Icon name="upload" />
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
              hidden
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void actions.onUpload?.(file);
              }}
            />
            上传图片
          </label>
        </div>
        {uploaded.length ? (
          <div className="stuff-grid is-img">
            {uploaded.map((img) => (
              <DecorBtn
                key={img.id}
                disabled={disabled}
                title={img.alt || img.id}
                payload={{ kind: 'image', imageId: img.id }}
                onAdd={actions.onAddOverlay}
              >
                <img src={img.url} alt="" />
              </DecorBtn>
            ))}
          </div>
        ) : (
          <p className="pane-hint">还没有上传。上传后可以拖到任意一页上。</p>
        )}
      </section>
    </div>
  );
}

function DecorBtn({
  children,
  title,
  disabled,
  payload,
  onAdd,
}: {
  children: ReactNode;
  title: string;
  disabled: boolean;
  payload: { kind: OverlayKind; emoji?: string; icon?: string; imageId?: string };
  onAdd?: InspectorActions['onAddOverlay'];
}) {
  return (
    <button
      type="button"
      className="stuff-item"
      title={title}
      disabled={disabled}
      draggable={!disabled}
      onDragStart={(e) => {
        const raw = JSON.stringify(payload);
        e.dataTransfer.setData('application/x-rcs-decor', raw);
        e.dataTransfer.setData('text/plain', raw);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onAdd?.(payload)}
    >
      {children}
    </button>
  );
}

function ImagePicks({
  images,
  selectedId,
  onPick,
}: {
  images: SourceImage[];
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  if (!images.length) return null;
  return (
    <div className="picks">
      {images.map((img) => (
        <button key={img.id} type="button" className={img.id === selectedId ? 'is-on' : ''} onClick={() => onPick(img.id)}>
          <img src={img.url} alt="" />
        </button>
      ))}
    </div>
  );
}

/** 封面上还缺的件。每种封面能放的件不同，只列当前封面用得上、又还没有的 */
function coverAdds(c: CoverSpec): Array<[string, Partial<CoverSpec>]> {
  const adds: Array<[string, Partial<CoverSpec> | false]> = [
    ['加引子', !c.kicker && { kicker: '一句引子' }],
  ];
  if (c.variant === 'poster') {
    adds.push(
      ['加流程框', !c.flow && { flow: { from: { title: '起点', lines: ['说明'] }, to: { title: '终点', lines: ['说明'] } } }],
      ['去掉流程框', Boolean(c.flow) && { flow: undefined }],
      ['加要点', (c.points?.length ?? 0) < 6 && { points: [...(c.points ?? []), '新的一条'] }],
    );
  }
  if (c.variant === 'digest') {
    adds.push(
      ['加导语', !c.lead && { lead: '一两句导语' }],
      ['加一行要点', (c.facts?.length ?? 0) < 4 && { facts: [...(c.facts ?? []), { label: '要点', text: '一句话' }] }],
      ['加数字', (c.stats?.length ?? 0) < 4 && { stats: [...(c.stats ?? []), { value: '0', label: '说明' }] }],
      ['加概述', !c.note && { note: '一句全篇概述' }],
    );
  }
  if (c.variant === 'headline') {
    adds.push(
      ['加利益点', !c.lead && { lead: '一句话说清能得到什么' }],
      ['加标签', (c.chips?.length ?? 0) < 3 && { chips: [...(c.chips ?? []), '新标签'] }],
    );
  }
  return adds.filter((a): a is [string, Partial<CoverSpec>] => Boolean(a[1]));
}

const KIND_LABELS: Record<CardBlockKind, string> = {
  h2: '章节',
  h3: '小节',
  p: '段落',
  ul: '列表',
  ol: '列表',
  code: '代码',
  quote: '引用',
  image: '配图',
  steps: '序号行',
  stats: '大数字',
  cards: '卡片组',
  callout: '提示框',
  table: '表格',
  flow: '流程图',
  chart: '条形图',
};

/** 各组件能加到几条、新加的一条长什么样 */
const ENTRY_RULES: Partial<Record<CardBlockKind, { min: number; max: number; blank: BlockEntry; highlight: boolean }>> = {
  steps: { min: 1, max: 6, blank: { title: '新的一条' }, highlight: false },
  stats: { min: 1, max: 4, blank: { value: '0', label: '说明' }, highlight: false },
  cards: { min: 1, max: 6, blank: { title: '新的一条' }, highlight: true },
  flow: { min: 2, max: 5, blank: { title: '新环节' }, highlight: true },
  chart: { min: 2, max: 6, blank: { label: '对象', value: '0' }, highlight: true },
};

const KIND_ICONS: Record<CardBlockKind, IconName> = {
  h2: 'heading',
  h3: 'heading',
  p: 'text',
  ul: 'list',
  ol: 'list',
  code: 'code',
  quote: 'quote',
  image: 'image',
  steps: 'list',
  stats: 'chart',
  cards: 'grid',
  callout: 'info',
  table: 'table',
  flow: 'flow',
  chart: 'chart',
};

/** 块的一行文字摘要，列表里截断显示 */
function previewOf(block: CardBlock): string {
  if (block.kind === 'image') return block.text ? plainText(block.text) : '一张配图';
  return plainText(
    block.text ??
      block.items?.join(' / ') ??
      block.entries?.map((e) => e.title ?? e.value ?? e.label).join(' / ') ??
      block.rows?.[0]?.join(' / ') ??
      block.code ??
      '',
  );
}

const TONES: Array<{ id: CalloutTone; label: string }> = [
  { id: 'accent', label: '强调' },
  { id: 'dark', label: '深色' },
  { id: 'warn', label: '警示' },
];

/** 组件块的结构调整。文字在卡片上直接改，这里只管加减条目、换语气这类卡片上做不了的事 */
function ComponentActions({
  block: b,
  disabled,
  onPatch,
}: {
  block: CardBlock;
  disabled: boolean;
  onPatch: (patch: Partial<CardBlock>) => void;
}) {
  const entries = b.entries ?? [];
  const rows = b.rows ?? [];
  const width = Math.max(1, ...rows.map((r) => r.length));

  switch (b.kind) {
    case 'steps':
    case 'stats':
    case 'cards':
    case 'flow':
    case 'chart': {
      const { min, max, blank, highlight } = ENTRY_RULES[b.kind]!;
      return (
        <>
          <div className="pane-acts">
            {entries.length < max ? (
              <Act icon="plus" disabled={disabled} onClick={() => onPatch({ entries: [...entries, blank] })}>
                加一条
              </Act>
            ) : null}
            {entries.length > min ? (
              <Act icon="minus" disabled={disabled} onClick={() => onPatch({ entries: entries.slice(0, -1) })}>
                删最后一条
              </Act>
            ) : null}
          </div>
          {b.kind === 'steps' ? (
            <Choice
              label="行首"
              options={[
                { id: 'number', label: '01 序号' },
                { id: 'arrow', label: '↳ 箭头' },
              ]}
              value={b.marker ?? 'number'}
              disabled={disabled}
              onPick={(marker) => onPatch({ marker })}
            />
          ) : null}
          {highlight ? (
            <Choice
              label="高亮"
              options={[{ id: -1, label: '不高亮' }, ...entries.map((_, i) => ({ id: i, label: `第 ${i + 1} ${b.kind === 'cards' ? '张' : '项'}` }))]}
              value={b.highlight ?? -1}
              disabled={disabled}
              onPick={(i) => onPatch({ highlight: i < 0 ? undefined : i })}
            />
          ) : null}
        </>
      );
    }

    case 'callout':
      return (
        <>
          <Choice label="语气" options={TONES} value={b.tone ?? 'accent'} disabled={disabled} onPick={(tone) => onPatch({ tone })} />
          <div className="pane-acts">
            {b.label ? (
              <Act icon="minus" disabled={disabled} onClick={() => onPatch({ label: undefined })}>
                去掉小标签
              </Act>
            ) : (
              <Act icon="plus" disabled={disabled} onClick={() => onPatch({ label: '小标签' })}>
                加小标签
              </Act>
            )}
          </div>
        </>
      );

    case 'table':
      return (
        <div className="pane-acts">
          <Act icon="plus" disabled={disabled} onClick={() => onPatch({ rows: [...rows, Array.from({ length: width }, () => '')] })}>
            加一行
          </Act>
          {rows.length > 2 ? (
            <Act icon="minus" disabled={disabled} onClick={() => onPatch({ rows: rows.slice(0, -1) })}>
              删最后一行
            </Act>
          ) : null}
          {width < 4 ? (
            <Act icon="plus" disabled={disabled} onClick={() => onPatch({ rows: rows.map((r) => [...r, '']) })}>
              加一列
            </Act>
          ) : null}
          {width > 2 ? (
            <Act icon="minus" disabled={disabled} onClick={() => onPatch({ rows: rows.map((r) => r.slice(0, width - 1)) })}>
              删最后一列
            </Act>
          ) : null}
        </div>
      );

    default:
      return null;
  }
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  disabled,
  onPick,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  disabled: boolean;
  onPick: (id: T) => void;
}) {
  return (
    <div className="pane-choice">
      <span>{label}</span>
      <div className="seg is-small">
        {options.map((o) => (
          <button key={String(o.id)} type="button" className={o.id === value ? 'is-on' : ''} disabled={disabled} onClick={() => onPick(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
