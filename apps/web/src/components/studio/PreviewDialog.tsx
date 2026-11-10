import { useRef, useState } from 'react';
import { unfoldNewlines, type Deck, type SourceImage } from '@rcs/shared';
import type { DeckLayout } from '../../layout/useDeckLayout';
import { plainText } from '../../render/inline';
import { PageThumb } from '../../render/PageThumb';
import { ScaledCard } from '../../render/ScaledCard';
import { useAuth } from '../../store/auth';
import { Dialog } from '../../ui/feedback';
import { Icon } from '../../ui/icons';

type View = 'note' | 'feed';

/** 小红书单帖图片上限 */
const PLATFORM_LIMIT = 18;

/** 照手机上的真实比例看一遍：笔记详情里逐张滑，发现页里看封面在双列缩略图下还读不读得清 */
export function PreviewDialog({
  deck,
  images,
  layout,
  total,
  onClose,
}: {
  deck: Deck;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  total: number;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>('note');
  const username = useAuth((s) => s.user?.username ?? '');
  const author = deck.settings.byline.split(/[/／|]/)[0]?.trim() || username;
  // 封面标题是手动断行的，拼回一行时断点挨着英文数字要留空格，纯中文直接接上
  const title = plainText(unfoldNewlines(deck.cover.title))
    .replace(/([A-Za-z0-9])\s*\n\s*|\s*\n\s*(?=[A-Za-z0-9])/g, (_, a?: string) => `${a ?? ''} `)
    .replace(/\s*\n\s*/g, '');
  const tags = deck.settings.topic
    .split(/[·・,，/|\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  const report = layout.report;

  const checks = [
    { ok: total <= PLATFORM_LIMIT, text: `共 ${total} 张，平台单帖上限 ${PLATFORM_LIMIT} 张` },
    { ok: report.overflowPages.length === 0, text: report.overflowPages.length ? `${report.overflowPages.length} 页内容装不下` : '每一页都装得下' },
    { ok: report.thinPages.length === 0, text: report.thinPages.length ? `${report.thinPages.length} 页偏空` : '没有过空的页' },
  ];

  return (
    <Dialog onClose={onClose} width={900} label="发布预览">
      <div className="pv">
        <aside className="pv-side">
          <div className="pv-side-head">
            <h3>发布预览</h3>
            <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <p>按手机上的真实比例模拟小红书，发布前确认封面和每一页的观感。</p>
          <div className="seg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={view === 'note'} onClick={() => setView('note')}>
              笔记详情
            </button>
            <button type="button" role="tab" aria-selected={view === 'feed'} onClick={() => setView('feed')}>
              发现页
            </button>
          </div>
          <p className="pv-tip">
            {view === 'note'
              ? '左右滑动或用下方圆点切换，检查每页字号在手机上是否舒适。'
              : '封面会以双列缩略图出现在信息流里，标题要能在这个尺寸下一眼读完。'}
          </p>
          <ul className="pv-checks">
            {checks.map((c) => (
              <li key={c.text} className={c.ok ? 'is-ok' : 'is-bad'}>
                <Icon name={c.ok ? 'checkCircle' : 'warn'} size={15} />
                {c.text}
              </li>
            ))}
          </ul>
        </aside>

        <div className="pv-stage">
          <div className="phone">
            <div className="phone-status">
              <b>9:41</b>
              <span />
            </div>
            {view === 'note' ? (
              <NoteView deck={deck} images={images} layout={layout} total={total} author={author} title={title} tags={tags} />
            ) : (
              <FeedView deck={deck} images={images} layout={layout} total={total} author={author} title={title} />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

interface ViewProps {
  deck: Deck;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  total: number;
  author: string;
  title: string;
}

function NoteView({ deck, images, layout, total, author, title, tags }: ViewProps & { tags: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="note">
      <div className="note-nav">
        <Icon name="back" size={18} />
        <span className="note-avatar">{author.slice(0, 1)}</span>
        <b>{author}</b>
        <span className="note-follow">关注</span>
      </div>
      <div className="note-scroll">
        <div className="note-media">
          <div
            ref={trackRef}
            className="note-track"
            onScroll={(e) => {
              const el = e.currentTarget;
              setCurrent(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {Array.from({ length: total }, (_, i) => (
              <div key={i} className="note-slide">
                <ScaledCard>
                  <PageThumb deck={deck} images={images} layout={layout} index={i} total={total} />
                </ScaledCard>
              </div>
            ))}
          </div>
          <span className="note-count">
            {current + 1}/{total}
          </span>
          {current > 0 ? (
            <button type="button" className="note-arrow is-prev" aria-label="上一张" onClick={() => go(current - 1)}>
              <Icon name="prev" size={16} />
            </button>
          ) : null}
          {current < total - 1 ? (
            <button type="button" className="note-arrow is-next" aria-label="下一张" onClick={() => go(current + 1)}>
              <Icon name="next" size={16} />
            </button>
          ) : null}
        </div>
        <div className="note-dots">
          {Array.from({ length: total }, (_, i) => (
            <button key={i} type="button" className={i === current ? 'is-on' : ''} aria-label={`第 ${i + 1} 张`} onClick={() => go(i)} />
          ))}
        </div>
        <div className="note-body">
          <h4>{title}</h4>
          <p className="note-lines">
            <i />
            <i />
            <i style={{ width: '62%' }} />
          </p>
          {tags.length ? (
            <p className="note-tags">
              {tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </p>
          ) : null}
          <span className="note-date">刚刚</span>
        </div>
      </div>
      <div className="note-bar">
        <span className="note-input">说点什么…</span>
        <span>
          <Icon name="heart" size={17} />
          赞
        </span>
        <span>
          <Icon name="star" size={17} />
          收藏
        </span>
        <span>
          <Icon name="chat" size={17} />
          评论
        </span>
      </div>
    </div>
  );
}

/** 两列信息流里的其他笔记只画灰块，免得喧宾夺主 */
const FILLERS = [
  { col: 0, h: 168 },
  { col: 1, h: 210 },
  { col: 1, h: 150 },
  { col: 0, h: 190 },
  { col: 1, h: 176 },
];

function FeedView({ deck, images, layout, total, author, title }: ViewProps) {
  const mine = (
    <div className="feed-item is-mine">
      <div className="feed-cover">
        <ScaledCard>
          <PageThumb deck={deck} images={images} layout={layout} index={0} total={total} />
        </ScaledCard>
      </div>
      <p className="feed-title">{title}</p>
      <div className="feed-meta">
        <span className="note-avatar is-sm">{author.slice(0, 1)}</span>
        <span>{author}</span>
        <em>
          <Icon name="heart" size={12} />
          赞
        </em>
      </div>
    </div>
  );

  return (
    <div className="feed">
      <div className="feed-tabs">
        <span>关注</span>
        <b>发现</b>
        <span>附近</span>
      </div>
      <div className="feed-chips">
        <b>推荐</b>
        <span>穿搭</span>
        <span>美食</span>
        <span>科技数码</span>
        <span>学习</span>
      </div>
      <div className="feed-cols">
        {[0, 1].map((col) => (
          <div key={col} className="feed-col">
            {col === 0 ? mine : null}
            {FILLERS.filter((f) => f.col === col).map((f, i) => (
              <div key={i} className="feed-item">
                <div className="feed-ghost" style={{ height: f.h }} />
                <i />
                <i style={{ width: '55%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
