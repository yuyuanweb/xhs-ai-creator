import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  PAGE_H,
  PAGE_W,
  defaultOverlay,
  dirtyPageIndexes,
  isUploadImage,
  mergeAiSnapshot,
  overlaysOnPage,
  pruneOverlays,
  replacePageBlocks,
  type BreakHint,
  type CardBlock,
  type Deck,
  type OverlayKind,
  type PageOverlay,
  type RewritePagesResult,
  type SourceArticle,
  type SourceImage,
} from '@rcs/shared';
import { articleApi, agentApi } from '../api/endpoints';
import type { UseAgentResult } from '../agent/useAgent';
import type { DeckHistory, SaveState, UpdateDeck } from '../editor/useDeckEditor';
import type { DeckLayout } from '../layout/useDeckLayout';
import { plainText } from '../render/inline';
import { buildSlots, CardStrip } from '../render/DeckCards';
import { ContentCard } from '../render/ContentCard';
import { CoverCard } from '../render/CoverCard';
import type { LiveEdit } from '../render/live-edit';
import { confirmDialog, errorText, toast } from '../ui/feedback';
import { Icon, type IconName } from '../ui/icons';
import { Spinner } from '../ui/Logo';
import { ExportBar } from './ExportBar';
import { AgentLock, AgentStatus } from './studio/AgentStatus';
import { BlockMenu } from './studio/BlockMenu';
import { DeckOverview } from './studio/DeckOverview';
import { PageTag, pageLabel } from './studio/PageTag';
import { PageRail } from './studio/PageRail';
import { PreviewDialog } from './studio/PreviewDialog';
import { SaveStatus } from './studio/SaveStatus';
import { Inspector, type InspectorTab, type PageContext } from './studio/Inspector';
import { RegenDialog } from './studio/RegenDialog';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 1;
const ZOOM_STEP = 0.08;
/** 画布四周留白：左右各一段，上方让出每页的页签，下方让出浮动工具条 */
const CANVAS_PAD_X = 72;
const CANVAS_PAD_Y = 116;

const DOCK: Array<{ tab: InspectorTab; icon: IconName; label: string }> = [
  { tab: 'page', icon: 'page', label: '本页' },
  { tab: 'style', icon: 'style', label: '样式' },
  { tab: 'stuff', icon: 'shapes', label: '素材' },
];

export function CardStudio({
  deck,
  article,
  images,
  layout,
  updateDeck,
  history,
  save,
  agent,
  onRetryImages,
  onArticleChange,
}: {
  deck: Deck;
  article: SourceArticle;
  images: Map<string, SourceImage>;
  layout: DeckLayout;
  updateDeck: UpdateDeck;
  history: DeckHistory;
  save: { state: SaveState; retry: () => void };
  agent: UseAgentResult;
  onRetryImages: () => Promise<void>;
  onArticleChange: (article: SourceArticle) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const [fit, setFit] = useState(0.48);
  const [zoom, setZoom] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>('page');
  const [regenOpen, setRegenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [view, setView] = useState<'canvas' | 'grid'>('canvas');
  const [previewOpen, setPreviewOpen] = useState(false);

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

  /** keepSelection：跟着编辑跳页时保留选中，否则在面板里连续调同一块会每点一下就丢一次选中 */
  const goTo = (i: number, behavior: ScrollBehavior = 'smooth', keepSelection = false) => {
    const next = Math.max(0, Math.min(maxIndex, i));
    if (!keepSelection) setSelectedId(null);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        history.redo();
        return;
      }
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
      if (e.key === 'Escape') {
        setSelectedId(null);
        setOverlayId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, maxIndex, history]);

  useEffect(() => {
    const id = followRef.current;
    if (!id) return;
    const pageIndex = layout.pages.findIndex((p) => p.blockIds.includes(id));
    if (pageIndex >= 0) goTo(pageIndex + 1, 'instant', true);
    followRef.current = null;
  }, [layout.pages]);

  // 选中一块内容时自动切到「本页」，省掉一次手动点击
  useEffect(() => {
    if (selectedId) setTab('page');
  }, [selectedId]);

  const slots = useMemo(
    () => (layout.measured ? buildSlots(deck, layout.pages, layout.blockMap, images) : []),
    [deck, layout.measured, layout.pages, layout.blockMap, images],
  );

  const live = useMemo<LiveEdit>(
    () => ({
      disabled: agent.running || busy,
      selectedId,
      onSelect: (id) => {
        setSelectedId(id);
        setOverlayId(null);
      },
      onText: (id, text) => patchBlock(id, { text }),
      onItems: (id, items) => patchBlock(id, { items }),
      onCode: (id, code) => patchBlock(id, { code }),
      onPatch: (id, patch) => patchBlock(id, patch),
      onCover: (cover) => updateDeck((prev) => ({ ...prev, cover: { ...prev.cover, ...cover } })),
      onSettings: (patch) => updateDeck((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),
    }),
    // patchBlock closes over updateDeck; selectedId must refresh the highlight
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent.running, busy, selectedId, updateDeck],
  );

  const overlayLive = useMemo(
    () => ({
      disabled: agent.running || busy,
      selectedId: overlayId,
      onSelect: (id: string | null) => {
        setOverlayId(id);
        if (id) setSelectedId(null);
      },
      onMove: (id: string, x: number, y: number) => patchOverlay(id, { x, y }),
      onResize: (id: string, size: number) => patchOverlay(id, { size }),
      onRemove: (id: string) => {
        setOverlayId(null);
        updateDeck((prev) => ({ ...prev, overlays: (prev.overlays ?? []).filter((o) => o.id !== id) }));
      },
    }),
    [agent.running, busy, overlayId, updateDeck],
  );

  const patchBlock = (id: string, patch: Partial<CardBlock>) => {
    followRef.current = id;
    updateDeck((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...patch };
        // 章节名是模型写的短标签时保留；只有它原本就是照抄标题的，才跟着标题一起改
        if (b.kind === 'h2' && patch.text !== undefined && b.section === plainText(b.text ?? '')) {
          next.section = plainText(patch.text);
        }
        return next;
      }),
    }));
  };

  const setHint = (id: string, hint: BreakHint | null) => {
    followRef.current = id;
    updateDeck((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== id) return b;
        const { breakHint: _drop, ...rest } = b;
        return hint ? { ...rest, breakHint: hint } : rest;
      }),
    }));
  };

  const toggleOff = (id: string, off: boolean) => {
    setSelectedId(null);
    updateDeck((prev) => ({
      ...prev,
      disabledBlockIds: off ? [...prev.disabledBlockIds, id] : prev.disabledBlockIds.filter((x) => x !== id),
    }));
  };

  const removeBlock = (id: string) => {
    setSelectedId(null);
    updateDeck((prev) => {
      const blocks = prev.blocks.filter((b) => b.id !== id);
      return {
        ...prev,
        blocks,
        overlays: pruneOverlays(prev.overlays ?? [], blocks),
        disabledBlockIds: prev.disabledBlockIds.filter((x) => x !== id),
      };
    });
  };

  const deletePage = async () => {
    if (isCover || !page) return;
    const ok = await confirmDialog({
      title: `删除${pageContext.label}？`,
      body: '这一页上的内容会从稿子里去掉，可以用撤销（⌘Z）找回。',
      confirmText: '删除这一页',
      danger: true,
    });
    if (!ok) return;
    const ids = page.blockIds;
    setSelectedId(null);
    updateDeck((prev) => {
      const blocks = prev.blocks.filter((b) => !ids.includes(b.id));
      return {
        ...prev,
        blocks,
        overlays: pruneOverlays(prev.overlays ?? [], blocks),
        disabledBlockIds: prev.disabledBlockIds.filter((id) => !ids.includes(id)),
      };
    });
  };

  const addOverlay = (partial: { kind: OverlayKind; emoji?: string; icon?: string; imageId?: string }, at?: { x: number; y: number }) => {
    const anchor = isCover ? 'cover' : page?.blockIds[0];
    if (!anchor) return;
    const next = defaultOverlay({ ...partial, anchor, ...(at ?? {}) });
    updateDeck((prev) => ({ ...prev, overlays: [...(prev.overlays ?? []), next] }));
    setOverlayId(next.id);
  };

  const patchOverlay = (id: string, patch: Partial<PageOverlay>) => {
    updateDeck((prev) => ({
      ...prev,
      overlays: (prev.overlays ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  };

  const dropDecor = (e: DragEvent<HTMLDivElement>, pageIndex: number) => {
    e.preventDefault();
    const card = (e.currentTarget as HTMLElement).querySelector('.card');
    if (!(card instanceof HTMLElement)) return;
    const rect = card.getBoundingClientRect();
    const at = {
      x: clampPct(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPct(((e.clientY - rect.top) / rect.height) * 100),
    };
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      void articleApi.uploadImage(article.id, file).then((next) => {
        onArticleChange(next);
        const uploaded = next.images.filter(isUploadImage).at(-1);
        if (uploaded) placeOverlay({ kind: 'image', imageId: uploaded.id }, pageIndex, at);
      });
      return;
    }
    const raw = e.dataTransfer.getData('application/x-rcs-decor') || e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      placeOverlay(JSON.parse(raw) as { kind: OverlayKind; emoji?: string; icon?: string; imageId?: string }, pageIndex, at);
    } catch {
      /* 不是素材库拖过来的 */
    }
  };

  const placeOverlay = (
    payload: { kind: OverlayKind; emoji?: string; icon?: string; imageId?: string },
    pageIndex: number,
    at?: { x: number; y: number },
  ) => {
    const anchor = pageIndex === 0 ? 'cover' : layout.pages[pageIndex - 1]?.blockIds[0];
    if (!anchor) return;
    const next = defaultOverlay({ ...payload, anchor, ...(at ?? {}) });
    updateDeck((prev) => ({ ...prev, overlays: [...(prev.overlays ?? []), next] }));
    setOverlayId(next.id);
  };

  const rewriteBlock = async (id: string) => {
    setBusy(true);
    try {
      const next = await agentApi.rewriteBlock(deck.id, id);
      updateDeck((prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? next : b)),
        aiSnapshot: mergeAiSnapshot(prev.aiSnapshot, { cover: prev.cover, blocks: [next] }, [id], false),
      }));
      toast.success('这一块已重新生成');
    } catch (err) {
      toast.error(errorText(err, '重新生成失败'));
    } finally {
      setBusy(false);
    }
  };

  const rewritePages = async (indexes: number[]) => {
    setBusy(true);
    setRegenOpen(false);
    try {
      const pages = indexes.map((i) => ({
        index: i,
        isCover: i === 0,
        blockIds: i === 0 ? [] : (layout.pages[i - 1]?.blockIds ?? []),
      }));
      const result = await agentApi.rewritePages(deck.id, pages);
      updateDeck((prev) => applyRewrite(prev, result));
      toast.success(`已重新生成 ${indexes.length} 页`);
    } catch (err) {
      toast.error(errorText(err, '重新生成失败'));
    } finally {
      setBusy(false);
    }
  };

  const page = index > 0 && index <= layout.pages.length ? layout.pages[index - 1] : undefined;
  const isCover = index === 0;
  const selectedPos = page?.blockIds.indexOf(selectedId ?? '') ?? -1;
  const missingImages = article.images.filter((img) => !img.url).length;

  const pageContext: PageContext = {
    index,
    label: pageLabel(index),
    blockIds: page?.blockIds ?? [],
    ...(page?.section ? { section: page.section } : {}),
    isCover,
    selectedPos,
    canJoin: selectedPos === 0 && index > 1,
    ...(page ? { fill: page.fill, overflow: page.overflow } : {}),
    ...(selectedId && layout.blockMap.get(selectedId) ? { selected: layout.blockMap.get(selectedId)! } : {}),
  };

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

  const dirty = useMemo(
    () => dirtyPageIndexes(deck, layout.pages),
    [deck, layout.pages],
  );

  const regenerate = async () => {
    if (!deck.blocks.length) {
      agent.start();
      return;
    }
    if (dirty.length) {
      setRegenOpen(true);
      return;
    }
    const ok = await confirmDialog({
      title: '整份重新生成？',
      body: 'AI 会从原文重新写一版卡片稿，覆盖现在这一版。',
      confirmText: '重新生成',
    });
    if (ok) agent.start();
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
            <span>{ready ? `共 ${layout.report.totalCards} 张` : deck.blocks.length ? '排版中' : '未生成'}</span>
            {ready && layout.report.thinPages.length ? (
              <span className="tag is-warn">{layout.report.thinPages.length} 页偏空</span>
            ) : null}
            {ready && layout.report.overflowPages.length ? (
              <span className="tag is-bad">{layout.report.overflowPages.length} 页装不下</span>
            ) : null}
            {ready && !layout.report.thinPages.length && !layout.report.overflowPages.length ? (
              <span className="tag is-ok">
                <Icon name="check" size={11} />
                排版达标
              </span>
            ) : null}
          </div>
        </div>

        <AgentStatus agent={agent} />

        <div className="st-acts">
          <div className="st-hist">
            <button type="button" className="sb is-icon" disabled={!history.canUndo} onClick={history.undo} title="撤销 ⌘Z">
              <Icon name="undo" />
            </button>
            <button type="button" className="sb is-icon" disabled={!history.canRedo} onClick={history.redo} title="重做 ⌘⇧Z">
              <Icon name="redo" />
            </button>
          </div>
          {agent.running || busy ? (
            <button className="sb" onClick={agent.running ? agent.stop : undefined} disabled={busy && !agent.running}>
              {busy && !agent.running ? <Spinner size={14} /> : <Icon name="stop" />}
              {busy && !agent.running ? '生成中…' : '停止'}
            </button>
          ) : (
            <button
              className={`sb is-ai${!deck.blocks.length ? ' is-primary' : ''}`}
              onClick={() => void regenerate()}
              title={deck.blocks.length ? '让 AI 重新写这一份稿子' : undefined}
            >
              <Icon name="generate" />
              {deck.blocks.length ? '重新生成' : '生成初稿'}
            </button>
          )}
          <button type="button" className="sb" disabled={!ready} onClick={() => setPreviewOpen(true)} title="按小红书手机界面预览">
            <Icon name="phone" />
            预览
          </button>
          <ExportBar article={article} stripRef={stripRef} ready={ready && slots.length > 0} />
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
        <nav className="st-dock" aria-label="面板">
          {DOCK.map((d) => (
            <button
              key={d.tab}
              type="button"
              className={tab === d.tab ? 'is-on' : ''}
              aria-pressed={tab === d.tab}
              onClick={() => setTab(d.tab)}
            >
              <Icon name={d.icon} size={20} />
              <span>{d.label}</span>
            </button>
          ))}
        </nav>

        <Inspector
          tab={tab}
          deck={deck}
          updateDeck={updateDeck}
          disabled={agent.running || busy}
          page={pageContext}
          images={article.images.filter((img) => img.url)}
          layoutBlocks={layout.blockMap}
          actions={{
            onSelect: (id) => {
              setSelectedId(id);
              setOverlayId(null);
            },
            onHint: setHint,
            onToggleOff: toggleOff,
            onCover: (patch) => updateDeck((prev) => ({ ...prev, cover: { ...prev.cover, ...patch } })),
            onImage: (id, imageId) => patchBlock(id, { imageId }),
            onPatch: patchBlock,
            onDeletePage: deletePage,
            onAddOverlay: addOverlay,
            onUpload: async (file) => {
              const next = await articleApi.uploadImage(article.id, file);
              onArticleChange(next);
              return next;
            },
          }}
        />

        <div className={`st-view${agent.running || busy ? ' is-locked' : ''}`}>
          <div className="st-stage">
            <AgentLock agent={agent} />
            <div
              className="st-canvas"
              ref={stageRef}
              onScroll={onCanvasScroll}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('.card, .blk-menu')) return;
                setSelectedId(null);
                setOverlayId(null);
              }}
            >
              {deck.blocks.length === 0 ? (
                agent.running ? (
                  <CanvasBlank busy title="AI 正在阅读原文、撰写初稿" text="通常需要一到三分钟，写完会自动排版并逐页检查。" />
                ) : (
                  <CanvasBlank title="还没有卡片" text="先让 AI 写一版初稿，再在这里逐页精修。">
                    <button type="button" className="btn is-primary" onClick={() => void regenerate()}>
                      <Icon name="generate" />
                      生成初稿
                    </button>
                  </CanvasBlank>
                )
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
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => dropDecor(e, i)}
                        >
                          <div className="st-scale" style={{ transform: `scale(${scale})` }}>
                            {i === 0 ? (
                              <CoverCard
                                cover={deck.cover}
                                settings={deck.settings}
                                total={total}
                                live={live}
                                images={images}
                                overlays={overlaysOnPage(deck.overlays ?? [], 0, layout.pages)}
                                overlayLive={overlayLive}
                              />
                            ) : slot ? (
                              <ContentCard
                                page={slot}
                                blocks={layout.blockMap}
                                images={images}
                                settings={deck.settings}
                                pageNo={i + 1}
                                total={total}
                                live={live}
                                overlays={overlaysOnPage(deck.overlays ?? [], i, layout.pages)}
                                overlayLive={overlayLive}
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

      <div className="export-source" ref={stripRef} aria-hidden>
        <CardStrip slots={slots} />
      </div>

      {selectedId && !agent.running && !busy ? (
        <BlockMenu
          targetId={selectedId}
          note={layout.blockMap.get(selectedId)?.note}
          disabled={false}
          onNote={(note) => patchBlock(selectedId, { note: note || undefined })}
          onRewrite={() => void rewriteBlock(selectedId)}
          onRemove={() => removeBlock(selectedId)}
        />
      ) : null}

      {regenOpen ? (
        <RegenDialog
          dirty={dirty}
          pages={Array.from({ length: total }, (_, i) => ({
            index: i,
            label: pageLabel(i),
            dirty: dirty.includes(i),
          }))}
          onCancel={() => setRegenOpen(false)}
          onConfirm={(scope) => {
            if (scope === 'all') {
              setRegenOpen(false);
              agent.start();
              return;
            }
            void rewritePages(scope);
          }}
        />
      ) : null}

      {previewOpen ? (
        <PreviewDialog deck={deck} images={images} layout={layout} total={total} onClose={() => setPreviewOpen(false)} />
      ) : null}
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

function clampPct(n: number): number {
  return Math.min(98, Math.max(2, n));
}

function applyRewrite(deck: Deck, result: RewritePagesResult): Deck {
  const blocks = replacePageBlocks(deck.blocks, result.groups);
  const drop = new Set(result.replacedIds);
  const kept = (deck.overlays ?? []).filter((o) => (o.anchor === 'cover' ? !result.coverReplaced : !drop.has(o.anchor)));
  const inserted = result.groups.flatMap((g) => g.insert);
  return {
    ...deck,
    blocks,
    cover: result.cover ?? deck.cover,
    overlays: pruneOverlays([...kept, ...result.overlays], blocks),
    aiSnapshot: mergeAiSnapshot(
      deck.aiSnapshot,
      { cover: result.cover ?? deck.cover, blocks: inserted },
      result.replacedIds,
      result.coverReplaced,
    ),
  };
}

function scrollCanvasTo(root: HTMLElement, i: number, behavior: ScrollBehavior) {
  const card = document.getElementById(`card-${i}`);
  if (!card) return;
  const delta = card.getBoundingClientRect().left - root.getBoundingClientRect().left;
  const left = root.scrollLeft + delta - (root.clientWidth - card.offsetWidth) / 2;
  root.scrollTo({ left: Math.max(0, left), behavior });
}
