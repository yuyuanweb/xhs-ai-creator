import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildArticleIndex, type Deck, type SourceArticle } from '@rcs/shared';
import { articleApi, deckApi } from '../api/endpoints';
import { useDeckEditor } from '../editor/useDeckEditor';
import { useDeckLayout } from '../layout/useDeckLayout';
import { Measurer } from '../render/Measurer';
import { CardStudio } from '../components/CardStudio';
import { Empty } from '../ui/Empty';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';

export function EditorPage() {
  const { deckId = '' } = useParams();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [article, setArticle] = useState<SourceArticle | null>(null);
  const [error, setError] = useState('');
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
      key={deck.id}
      initial={deck}
      article={article}
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
  onRetryImages,
}: {
  initial: Deck;
  article: SourceArticle;
  onRetryImages: () => Promise<void>;
}) {
  const editor = useDeckEditor(initial);
  const index = useMemo(() => buildArticleIndex(article), [article]);
  const { images } = index;
  const layout = useDeckLayout(editor.deck, index);

  return (
    <>
      <CardStudio
        deck={editor.deck}
        article={article}
        images={images}
        layout={layout}
        updateDeck={editor.updateDeck}
        save={{ state: editor.saveState, retry: editor.retrySave }}
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
