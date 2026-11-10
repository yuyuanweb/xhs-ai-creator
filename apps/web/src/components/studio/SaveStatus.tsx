import { useEffect } from 'react';
import type { SaveState } from '../../editor/useDeckEditor';
import { toast } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { Spinner } from '../../ui/Logo';

export function SaveStatus({ state, retry }: { state: SaveState; retry: () => void }) {
  useEffect(() => {
    if (state === 'error') toast.error('自动保存失败，请检查网络后点顶栏的「重试」');
  }, [state]);

  if (state === 'error') {
    return (
      <button type="button" className="save-status is-error" onClick={retry}>
        <Icon name="warn" size={13} />
        保存失败 · 重试
      </button>
    );
  }
  if (state === 'saved') {
    return (
      <span className="save-status" title="所有改动都已自动保存">
        <Icon name="cloud" size={13} />
        已保存
      </span>
    );
  }
  return (
    <span className="save-status">
      <Spinner size={11} />
      保存中
    </span>
  );
}
