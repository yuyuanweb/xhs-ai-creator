import { useState, type RefObject } from 'react';
import type { SourceArticle } from '@rcs/shared';
import { detectClipping, downloadBlob, exportDeckToZip, type ExportProgress } from '../export/exportDeck';
import { errorText, toast } from '../ui/feedback';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';

export function ExportBar({
  article,
  stripRef,
  ready,
}: {
  article: SourceArticle;
  stripRef: RefObject<HTMLDivElement | null>;
  ready: boolean;
}) {
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const root = stripRef.current;
    if (!root || busy) return;

    setBusy(true);
    const issues = detectClipping(root);
    if (issues.length) toast.warn(`有内容被裁切：${issues.join('；')}`, 9000);

    try {
      let total = 0;
      const blob = await exportDeckToZip(root, {
        onProgress: (p) => {
          total = p.total;
          setProgress(p);
        },
      });
      downloadBlob(blob, `${article.title.replace(/[/\\:*?"<>|]/g, '')}.zip`);
      toast.success(total ? `已导出 ${total} 张卡片` : '导出完成');
    } catch (err) {
      toast.error(errorText(err, '导出失败'));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <button className="sb is-ink" disabled={!ready || busy} onClick={() => void run()} title="导出全部卡片为 PNG 压缩包">
      {busy ? <Spinner size={14} /> : <Icon name="export" />}
      {progress ? `导出中 ${progress.done}/${progress.total}` : busy ? '准备导出…' : '导出'}
    </button>
  );
}
