import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { buildArticleIndex, type Deck, type SourceArticle } from '@rcs/shared';
import { articleApi, deckApi } from '../api/endpoints';
import { useDeckEditor } from '../editor/useDeckEditor';
import { useExternalRevision } from '../editor/useExternalRevision';
import { useLayoutUpload } from '../editor/useLayoutUpload';
import { useDeckLayout } from '../layout/useDeckLayout';
import { useAgent } from '../agent/useAgent';
import { Measurer } from '../render/Measurer';
import { CardStudio } from '../components/CardStudio';
import { Empty } from '../ui/Empty';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';

export function EditorPage() {
  const { deckId = '' } = useParams();
  const autostart = Boolean((useLocation().state as { autostart?: boolean } | null)?.autostart);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [article, setArticle] = useState<SourceArticle | null>(null);
  const [error, setError] = useState('');
  /** 外部改稿后整块编辑区重挂：测高缓存属于旧稿，不能接着用 */
  const [reloads, setReloads] = useState(0);

  useExternalRevision(deckId, () => {
    void deckApi
      .get(deckId)
      .then((d) => {
        setDeck(d);
        setReloads((n) => n + 1);
      })
      .catch((err: Error) => setError(err.message));
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const d = await deckApi.get(deckId);
        const a = await articleApi.get(d.articleId);
        if (!alive) return;
        setDeck(d);
        setArticle(a);
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deckId]);

  if (error) return <EditorFallback error={error} />;
  if (!deck || !article) return <EditorFallback />;

  return (
    <Workspace
      key={`${deck.id}:${reloads}`}
      initial={deck}
      article={article}
      autostart={autostart}
      onRetryImages={async () => setArticle(await articleApi.retryImages(article.id))}
    />
  );
}

function EditorFallback({ error }: { error?: string }) {
  return (
    <div className="editor-fallback">
      {error ? (
        <Empty icon="warn" title="这份稿子打不开" text={error} />
      ) : (
        <>
          <Spinner size={22} />
          <span>正在打开编辑台…</span>
        </>
      )}
      <Link to="/" className="btn">
        <Icon name="back" />
        返回文章列表
      </Link>
    </div>
  );
}

function Workspace({
  initial,
  article,
  autostart,
  onRetryImages,
}: {
  initial: Deck;
  article: SourceArticle;
  autostart: boolean;
  onRetryImages: () => Promise<void>;
}) {
  const editor = useDeckEditor(initial);
  const index = useMemo(() => buildArticleIndex(article), [article]);
  const { images } = index;
  const layout = useDeckLayout(editor.deck, index);
  const agent = useAgent(editor.deck, editor.updateDeck, layout, index);
  useLayoutUpload(editor.deck, layout);

  useEffect(() => {
    if (!autostart || editor.deck.blocks.length > 0) return;
    agent.start();
  }, [autostart, agent.start, editor.deck.blocks.length]);

  return (
    <>
      <CardStudio
        deck={editor.deck}
        article={article}
        images={images}
        layout={layout}
        updateDeck={editor.updateDeck}
        save={{ state: editor.saveState, retry: editor.retrySave }}
        agent={agent}
        onRetryImages={onRetryImages}
      />
      {/* 测高容器必须始终挂载，否则分页永远拿不到高度 */}
      <Measurer
        blocks={layout.activeBlocks}
        images={images}
        settings={editor.deck.settings}
        onMeasure={layout.onMeasure}
      />
    </>
  );
}
