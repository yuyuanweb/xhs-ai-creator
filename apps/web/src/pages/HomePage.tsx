import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultCover, defaultDeckSettings, type SourceImage } from '@rcs/shared';
import { articleApi, deckApi, libraryApi, type LibraryItem } from '../api/endpoints';
import { useFilePicker } from '../components/CreateDialog';
import { CoverCard } from '../render/CoverCard';
import { ScaledCard } from '../render/ScaledCard';
import { useAuth } from '../store/auth';
import { useCreate, useCreateArticle } from '../store/create';
import { Empty } from '../ui/Empty';
import { confirmDialog, errorText, toast } from '../ui/feedback';
import { fullTime, relativeTime } from '../ui/format';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';
import { Menu } from '../ui/Menu';

type Filter = 'all' | 'done' | 'todo' | 'fix';

const FILTERS: Array<{ id: Filter; label: string; test: (item: LibraryItem) => boolean }> = [
  { id: 'all', label: '全部', test: () => true },
  { id: 'done', label: '已生成', test: (i) => (i.deck?.blockCount ?? 0) > 0 },
  { id: 'todo', label: '未生成', test: (i) => !i.deck?.blockCount },
  { id: 'fix', label: '需调整', test: (i) => Boolean(i.layout && (i.layout.overflow || i.layout.thin)) },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function HomePage() {
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await libraryApi.list());
      setLoadError('');
    } catch (err) {
      setLoadError(errorText(err, '作品加载失败'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, (items ?? []).filter(f.test).length])) as Record<Filter, number>,
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.id === filter)!.test;
    return (items ?? []).filter((i) => test(i) && (!q || i.title.toLowerCase().includes(q)));
  }, [items, filter, query]);

  const remove = async (item: LibraryItem) => {
    const ok = await confirmDialog({
      title: '删除这篇作品？',
      body: (
        <>
          「{item.title}」的原文和所有卡片稿都会被删除，<b>删除后无法恢复</b>。
        </>
      ),
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await articleApi.remove(item.articleId);
      setItems((prev) => prev?.filter((i) => i.articleId !== item.articleId) ?? null);
      toast.success('已删除');
    } catch (err) {
      toast.error(errorText(err, '删除失败'));
    }
  };

  return (
    <div className="home">
      <PageDrop />
      <header className="home-head">
        <div>
          <h1>
            {greeting()}，{user?.username}
          </h1>
          <p>今天想把哪篇长文变成卡片？</p>
        </div>
      </header>

      <Hero items={items ?? []} />

      <section className="works">
        <div className="works-head">
          <h2>我的作品</h2>
          <div className="chips" role="tablist">
            {FILTERS.filter((f) => f.id !== 'fix' || counts.fix > 0).map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`chip${f.id === 'fix' ? ' is-warn' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {items ? <span>{counts[f.id]}</span> : null}
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索作品标题" />
            {query ? (
              <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
                <Icon name="close" size={14} />
              </button>
            ) : null}
          </label>
        </div>

        {loadError ? (
          <Empty icon="warn" title="加载失败" text={loadError} action={{ label: '重新加载', onClick: () => void load() }} />
        ) : items === null ? (
          <div className="work-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="work is-skeleton">
                <div className="work-thumb" />
                <i />
                <i />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty icon="layers" title="还没有作品" text="导入第一篇长文，几分钟后就能拿到一整组小红书卡片。" />
        ) : shown.length === 0 ? (
          <Empty icon="search" title="没有符合条件的作品" text="换个关键词或筛选条件试试。" />
        ) : (
          <div className="work-grid">
            {shown.map((item) => (
              <WorkCard key={item.articleId} item={item} onRemove={() => void remove(item)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Hero({ items }: { items: LibraryItem[] }) {
  const open = useCreate((s) => s.open);
  const pick = useFilePicker();
  const covers = items.filter((i) => i.deck?.blockCount).slice(0, 3);

  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">
          <Icon name="generate" size={14} />
          AI 图文工作流
        </span>
        <h2>把一篇长文，变成一组会被收藏的卡片</h2>
        <ol className="hero-steps">
          <li>
            <b>1</b>导入长文
          </li>
          <li>
            <b>2</b>AI 改写排版
          </li>
          <li>
            <b>3</b>精修后导出
          </li>
        </ol>
        <div className="hero-acts">
          <button type="button" className="btn is-primary is-lg" onClick={pick}>
            <Icon name="upload" />
            导入 Markdown
          </button>
          <button type="button" className="btn is-lg" onClick={() => open('paste')}>
            <Icon name="doc" />
            粘贴正文
          </button>
        </div>
        <p className="hero-hint">也可以直接把 .md 文件拖到页面任意位置</p>
      </div>
      <div className="hero-fan" aria-hidden>
        {covers.length ? (
          covers.map((item, i) => (
            <div key={item.articleId} className={`fan-card is-${i}`}>
              <CoverThumb item={item} />
            </div>
          ))
        ) : (
          <>
            <div className="fan-card is-0 is-blank" />
            <div className="fan-card is-1 is-blank" />
            <div className="fan-card is-2 is-blank" />
          </>
        )}
      </div>
    </section>
  );
}

function WorkCard({ item, onRemove }: { item: LibraryItem; onRemove: () => void }) {
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const generated = (item.deck?.blockCount ?? 0) > 0;

  const open = async () => {
    if (opening) return;
    if (item.deck) {
      navigate(`/decks/${item.deck.id}`);
      return;
    }
    setOpening(true);
    try {
      const deck = await deckApi.create(item.articleId);
      navigate(`/decks/${deck.id}`);
    } catch (err) {
      toast.error(errorText(err, '打开失败'));
      setOpening(false);
    }
  };

  return (
    <article className="work">
      <div
        className="work-thumb"
        role="button"
        tabIndex={0}
        aria-label={`打开「${item.title}」`}
        onClick={() => void open()}
        onKeyDown={(e) => e.key === 'Enter' && void open()}
      >
        <CoverThumb item={item} />
        <span className="work-open">
          {opening ? <Spinner size={14} /> : <Icon name={generated ? 'arrowRight' : 'generate'} size={14} />}
          {generated ? '打开编辑' : '去生成'}
        </span>
      </div>
      <div className="work-info">
        <div className="work-text">
          <h3 title={item.title}>{item.title}</h3>
          <span className="work-meta" title={`创建于 ${fullTime(item.createdAt)}`}>
            <WorkStatus item={item} />
            {relativeTime(item.updatedAt)}
          </span>
        </div>
        <Menu
          className="work-more"
          label="更多操作"
          trigger={<Icon name="more" size={18} />}
          items={[
            { label: generated ? '打开编辑' : '去生成', icon: 'arrowRight', onSelect: () => void open() },
            { label: '删除', icon: 'trash', danger: true, onSelect: onRemove },
          ]}
        />
      </div>
    </article>
  );
}

/** 有问题的稿子给彩色标签，正常的只写张数 */
function WorkStatus({ item }: { item: LibraryItem }) {
  if (!item.deck?.blockCount) return <span className="tag is-mute">未生成</span>;
  if (item.deck.status === 'generating') return <span className="tag is-brand">生成中</span>;
  if (item.layout?.overflow) return <span className="tag is-bad">{item.layout.overflow} 页装不下</span>;
  if (item.layout?.thin) return <span className="tag is-warn">{item.layout.thin} 页偏空</span>;
  return <span>{item.layout ? `${item.layout.cards} 张 ·` : '已生成 ·'}</span>;
}

/** 作品封面。没生成过的稿子也画一张默认封面，网格才整齐 */
function CoverThumb({ item }: { item: LibraryItem }) {
  const images = useMemo(() => new Map<string, SourceImage>(item.coverImages.map((img) => [img.id, img])), [item.coverImages]);
  const settings = item.deck?.settings ?? defaultDeckSettings();
  return (
    <ScaledCard>
      <CoverCard
        cover={item.deck?.cover ?? defaultCover(item.title)}
        settings={{ ...settings, showPageNumber: Boolean(item.layout) && settings.showPageNumber }}
        total={item.layout?.cards ?? 1}
        overlays={item.deck?.overlays ?? []}
        images={images}
      />
    </ScaledCard>
  );
}

/** 拖着 Markdown 文件进到首页任意位置，就给出整页的放下提示 */
function PageDrop() {
  const { fromFile } = useCreateArticle();
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || useCreate.getState().dialog) return;
      depth.current += 1;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const overFn = (e: DragEvent) => hasFiles(e) && !useCreate.getState().dialog && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e) || useCreate.getState().dialog) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      void fromFile(e.dataTransfer?.files[0]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, [fromFile]);

  if (!over) return null;
  return (
    <div className="page-drop">
      <div>
        <span className="dropzone-icon">
          <Icon name="upload" size={24} />
        </span>
        <strong>松开即可导入</strong>
        <span>支持 .md / .markdown / .txt，导入后自动开始生成</span>
      </div>
    </div>
  );
}
