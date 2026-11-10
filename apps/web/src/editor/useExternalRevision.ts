import { useEffect, useRef } from 'react';
import { deckApi } from '../api/endpoints';

const POLL_MS = 2000;

/**
 * Cursor 里的模型通过 MCP 改了这份稿，编辑台自己重新加载，用户不用手动刷新，模型也能马上拿到新一版的测高结果。
 * 服务重启后修订号为空，这时沿用上次看到的值，免得无故重载、丢掉还没落盘的改动
 */
export function useExternalRevision(deckId: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let alive = true;
    let seen: number | null | undefined;

    const tick = async () => {
      const revision = await deckApi
        .sync(deckId)
        .then((r) => r.externalRevision)
        .catch(() => null);
      if (!alive) return;
      if (seen === undefined) {
        seen = revision;
        return;
      }
      if (revision === null || revision === seen) return;
      seen = revision;
      onChangeRef.current();
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [deckId]);
}
