import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PAGE_H, PAGE_W, overlaysOnPage, type Deck, type SourceArticle, type SourceImage } from '@rcs/shared';
import type { SaveState, UpdateDeck } from '../editor/useDeckEditor';
import type { DeckLayout } from '../layout/useDeckLayout';
import { ContentCard } from '../render/ContentCard';
import { CoverCard } from '../render/CoverCard';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';
import { DeckOverview } from './studio/DeckOverview';
import { PageTag, pageLabel } from './studio/PageTag';
import { PageRail } from './studio/PageRail';
import { SaveStatus } from './studio/SaveStatus';
import { SettingsPanel } from './SettingsPanel';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 1;
const ZOOM_STEP = 0.08;
/** 画布四周留白：左右各一段，上方让出每页的页签，下方让出浮动工具条 */
const CANVAS_PAD_X = 72;
const CANVAS_PAD_Y = 116;

export function CardStudio({
  deck,
  article,
  images,
  layout,
  updateDeck,
  save,
  onRetryImages,
}: {
  deck: Deck;
  article: SourceArticle;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  updateDeck: UpdateDeck;
  save: { state: SaveState; retry: () => void };
  onRetryImages: () => Promise<void>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [fit, setFit] = useState(0.48);
  const [zoom, setZoom] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<'canvas' | 'grid'>('canvas');

  const total = layout.pages.length + 1;
  const maxIndex = Math.max(0, total - 1);
  const scale = zoom ?? fit;
  const ready = deck.blocks.length > 0 && layout.measured;

  // 改字号、主题时会先清空测高，页数瞬间变成 0。这时不能把当前页夹到第一张。
  useEffect(() => {
    if (!layout.measured) return;
    setIndex((i) => Math.min(i, maxIndex));
  }, [layout.measured, maxIndex]);

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const measure = () => {
      const raw = Math.min((root.clientWidth - CANVAS_PAD_X) / PAGE_W, (root.clientHeight - CANVAS_PAD_Y) / PAGE_H);
      const next = Math.max(ZOOM_MIN, Math.min(raw, 0.72));
      setFit((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [ready]);

  const goTo = (i: number, behavior: ScrollBehavior = 'smooth') => {
    const next = Math.max(0, Math.min(maxIndex, i));
    setIndex(next);
    const root = stageRef.current;
    if (!root) return;
    syncingRef.current = true;
    // 平滑滚动的时长随距离变化，固定超时会在半路放开，页码就跟着滑过的每一页乱跳
    const release = () => {
      syncingRef.current = false;
      root.removeEventListener('scrollend', release);
      clearTimeout(fallback);
    };
    const fallback = window.setTimeout(release, 1200);
    root.addEventListener('scrollend', release);
    scrollCanvasTo(root, next, behavior);
  };

  useEffect(() => {
    if (!ready) return;
    const root = stageRef.current;
    if (!root) return;
    syncingRef.current = true;
    scrollCanvasTo(root, index, 'instant');
    const timer = window.setTimeout(() => {
      syncingRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, [ready, scale]);

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('textarea, input, [contenteditable="true"]')) return;
      if (document.activeElement instanceof HTMLTextAreaElement) return;
      if (document.activeElement instanceof HTMLInputElement) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      root.scrollLeft += e.deltaY;
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, maxIndex]);

  const missingImages = article.images.filter((img) => !img.url).length;

  const onCanvasScroll = () => {
    const root = stageRef.current;
    if (!root || syncingRef.current) return;
    const mid = root.getBoundingClientRect().left + root.clientWidth / 2;
    let best = index;
    let dist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < total; i++) {
      const el = document.getElementById(`card-${i}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const d = Math.abs(rect.left + rect.width / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    if (best !== index) setIndex(best);
  };

  return (
    <div className="studio">
      <header className="st-bar">
        <Link to="/" className="st-home" title="返回我的作品" aria-label="返回我的作品">
          <Icon name="back" size={18} />
        </Link>
        <div className="st-id">
          <div className="st-crumb">
            <Link to="/">我的作品</Link>
            <Icon name="next" size={12} />
            <span className="st-name" title={article.title}>
              {article.title}
            </span>
          </div>
          <div className="st-meta">
            <SaveStatus state={save.state} retry={save.retry} />
            <i className="st-dot" />
            <span>{ready ? `共 ${total} 张` : deck.blocks.length ? '排版中' : '未生成'}</span>
          </div>
        </div>

      </header>

      {missingImages > 0 ? (
        <div className="st-banner">
          <Icon name="warn" />
          <span>
            有 <b>{missingImages}</b> 张配图没抓取成功，卡片上暂时不会显示。
          </span>
          <button className="link" onClick={() => void onRetryImages()}>
            重新抓取
          </button>
        </div>
      ) : null}

      <div className="st-work">
        <aside className="st-panel">
          <header className="st-panel-head">
            <h2>样式</h2>
            <span>整份稿子共用的主题和版式</span>
          </header>
          <div className="st-panel-body">
            <SettingsPanel deck={deck} updateDeck={updateDeck} disabled={false} />
          </div>
        </aside>

        <div className="st-view">
          <div className="st-stage">
            <div
              className="st-canvas"
              ref={stageRef}
              onScroll={onCanvasScroll}
            >
              {deck.blocks.length === 0 ? (
                <CanvasBlank title="还没有卡片" text="卡片稿写好后，会在这里按真实排版逐页展示。" />
              ) : !layout.measured ? (
                <CanvasBlank busy title="正在测量排版" text="按真实字号计算每一页能放下多少内容。" />
              ) : (
                <div className="st-track">
                  {Array.from({ length: total }, (_, i) => {
                    const slot = layout.pages[i - 1];
                    return (
                      <div className={`st-slot${i === index ? ' is-current' : ''}`} key={i} style={{ width: PAGE_W * scale }}>
                        <button type="button" className="st-cap" onClick={() => goTo(i)}>
                          <b>{pageLabel(i)}</b>
                          {slot ? <PageTag fill={slot.fill} overflow={slot.overflow} /> : null}
                        </button>
                        <div
                          id={`card-${i}`}
                          className={`st-frame${slot?.overflow ? ' is-bad' : ''}`}
                          style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
                        >
                          <div className="st-scale" style={{ transform: `scale(${scale})` }}>
                            {i === 0 ? (
                              <CoverCard
                                cover={deck.cover}
                                settings={deck.settings}
                                total={total}
                                images={images}
                                overlays={overlaysOnPage(deck.overlays ?? [], 0, layout.pages)}
                              />
                            ) : slot ? (
                              <ContentCard
                                page={slot}
                                blocks={layout.blockMap}
                                images={images}
                                settings={deck.settings}
                                pageNo={i + 1}
                                total={total}
                                overlays={overlaysOnPage(deck.overlays ?? [], i, layout.pages)}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {ready && view === 'grid' ? (
              <DeckOverview
                deck={deck}
                images={images}
                layout={layout}
                total={total}
                index={index}
                onPick={(i) => {
                  setView('canvas');
                  // 等画布从总览下面露出来再定位
                  requestAnimationFrame(() => goTo(i, 'instant'));
                }}
              />
            ) : null}

            {ready ? (
              <PageRail
                deck={deck}
                images={images}
                layout={layout}
                index={index}
                total={total}
                onPick={goTo}
              />
            ) : null}
          </div>

          {ready ? (
            <div className="st-bottom">
              <div className="st-views" role="tablist" aria-label="视图">
                <button type="button" role="tab" aria-selected={view === 'canvas'} onClick={() => setView('canvas')} title="画布">
                  <Icon name="canvas" />
                </button>
                <button type="button" role="tab" aria-selected={view === 'grid'} onClick={() => setView('grid')} title="总览">
                  <Icon name="grid" />
                </button>
              </div>
              <div className="st-nav">
                <button type="button" disabled={index === 0} onClick={() => goTo(index - 1)} aria-label="上一张">
                  <Icon name="prev" />
                </button>
                <span>
                  {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  disabled={index >= maxIndex}
                  onClick={() => goTo(index + 1)}
                  aria-label="下一张"
                >
                  <Icon name="next" />
                </button>
              </div>

              <div className="st-zoom" hidden={view === 'grid'}>
                <button type="button" onClick={() => setZoom(clampZoom(scale - ZOOM_STEP))} aria-label="缩小">
                  <Icon name="minus" />
                </button>
                <span>{Math.round(scale * 100)}%</span>
                <button type="button" onClick={() => setZoom(clampZoom(scale + ZOOM_STEP))} aria-label="放大">
                  <Icon name="plus" />
                </button>
                <button type="button" className={zoom === null ? 'is-on' : ''} onClick={() => setZoom(null)} aria-label="适应窗口">
                  <Icon name="fit" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

    </div>
  );
}

function CanvasBlank({ busy, title, text, children }: { busy?: boolean; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="st-blank">
      <span className="st-blank-icon">{busy ? <Spinner size={22} /> : <Icon name="layers" size={24} />}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {children}
    </div>
  );
}


function clampZoom(n: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(n.toFixed(2))));
}

function scrollCanvasTo(root: HTMLElement, i: number, behavior: ScrollBehavior) {
  const card = document.getElementById(`card-${i}`);
  if (!card) return;
  const delta = card.getBoundingClientRect().left - root.getBoundingClientRect().left;
  const left = root.scrollLeft + delta - (root.clientWidth - card.offsetWidth) / 2;
  root.scrollTo({ left: Math.max(0, left), behavior });
}
