import { useCallback, useEffect, useState } from 'react';
import { promptApi, type PromptRow } from '../api/endpoints';
import { Empty } from '../ui/Empty';
import { confirmDialog, errorText, toast } from '../ui/feedback';
import { fullTime, relativeTime } from '../ui/format';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';

export function PromptsPage() {
  const [rows, setRows] = useState<PromptRow[] | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await promptApi.list();
      setRows(list);
      setSaved(Object.fromEntries(list.map((r) => [r.key, r.content])));
      setActiveKey((k) => k || list[0]?.key || '');
      setLoadError('');
    } catch (err) {
      setLoadError(errorText(err, '提示词加载失败'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = (row: PromptRow) => {
    setRows((prev) => prev?.map((r) => (r.key === row.key ? row : r)) ?? null);
    setSaved((prev) => ({ ...prev, [row.key]: row.content }));
  };

  const active = rows?.find((r) => r.key === activeKey);
  const dirty = (r: PromptRow) => saved[r.key] !== r.content;

  const save = useCallback(async () => {
    if (!active || saving || saved[active.key] === active.content) return;
    setSaving(true);
    try {
      accept(await promptApi.update(active.key, active.content));
      toast.success(`「${active.title}」已保存，下一次生成生效`);
    } catch (err) {
      toast.error(errorText(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  }, [active, saving, saved]);

  const reset = async () => {
    if (!active) return;
    const ok = await confirmDialog({
      title: '恢复默认提示词？',
      body: `「${active.title}」会回到出厂版本，你对它的所有修改都会丢失。`,
      confirmText: '恢复默认',
      danger: true,
    });
    if (!ok) return;
    try {
      accept(await promptApi.reset(active.key));
      toast.success('已恢复默认');
    } catch (err) {
      toast.error(errorText(err, '恢复失败'));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  return (
    <div className="page is-wide">
      <header className="page-head">
        <div>
          <h1>提示词</h1>
          <p>AI 写稿时遵循的几段规则。想让生成风格更自然，就在这里反复调整，保存后下一次生成立即生效。</p>
        </div>
      </header>

      {loadError ? (
        <section className="surface">
          <Empty icon="warn" title="加载失败" text={loadError} action={{ label: '重新加载', onClick: () => void load() }} />
        </section>
      ) : rows === null ? (
        <section className="surface prompt-loading">
          <Spinner size={20} />
        </section>
      ) : (
        <div className="prompt-layout">
          <nav className="surface prompt-nav" aria-label="提示词列表">
            {rows.map((r) => (
              <button
                key={r.key}
                type="button"
                className={r.key === activeKey ? 'is-on' : ''}
                onClick={() => setActiveKey(r.key)}
              >
                <span className="prompt-nav-title">
                  {r.title}
                  {dirty(r) ? <i className="dirty-dot" title="有未保存的修改" /> : null}
                </span>
                <code>{r.key}</code>
              </button>
            ))}
          </nav>

          {active ? (
            <section className="surface prompt-editor">
              <header>
                <div>
                  <h2>{active.title}</h2>
                  <span title={fullTime(active.updatedAt)}>
                    <code>{active.key}</code> · 更新于 {relativeTime(active.updatedAt)}
                  </span>
                </div>
                <div className="prompt-acts">
                  <button type="button" className="btn is-ghost" onClick={() => void reset()}>
                    <Icon name="reset" />
                    恢复默认
                  </button>
                  <button
                    type="button"
                    className="btn is-primary"
                    disabled={saving || !dirty(active)}
                    onClick={() => void save()}
                  >
                    {saving ? <Spinner /> : <Icon name="check" />}
                    {saving ? '保存中…' : '保存'}
                    <kbd>⌘S</kbd>
                  </button>
                </div>
              </header>
              <textarea
                className="prompt-input"
                value={active.content}
                spellCheck={false}
                onChange={(e) => {
                  const content = e.target.value;
                  setRows((prev) => prev?.map((r) => (r.key === active.key ? { ...r, content } : r)) ?? null);
                }}
              />
              <footer>
                <span>{active.content.length.toLocaleString()} 字符</span>
                {dirty(active) ? (
                  <span className="is-dirty">
                    <i className="dirty-dot" />
                    有未保存的修改
                  </span>
                ) : (
                  <span>
                    <Icon name="check" size={12} />
                    已保存
                  </span>
                )}
              </footer>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
