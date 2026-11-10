import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Deck, SourceArticle } from '@rcs/shared';
import { articleApi, deckApi } from '../api/endpoints';
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

  const missing = article.images.filter((img) => !img.url).length;
  return (
    <div className="editor-fallback">
      <Empty
        icon="layers"
        title={article.title}
        text={`已解析出 ${article.blocks.length} 个内容块、${article.images.length} 张配图${missing ? `，其中 ${missing} 张没抓取成功` : ''}。卡片渲染接入后，这里就是编辑台。`}
      />
      {missing ? (
        <button className="btn" onClick={() => void articleApi.retryImages(article.id).then(setArticle)}>
          重新抓取配图
        </button>
      ) : null}
      <Link to="/" className="btn">
        <Icon name="back" />
        返回文章列表
      </Link>
    </div>
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
