import { useEffect, useRef, useState } from 'react';
import { MIN_LENGTH, useCreate, useCreateArticle, type CreateMode } from '../store/create';
import { Dialog } from '../ui/feedback';
import { Icon } from '../ui/icons';
import { Spinner } from '../ui/Logo';

const ACCEPT = '.md,.markdown,.txt,text/markdown,text/plain';

/** 新建图文的对话框和忙碌遮罩，整个应用只挂一份 */
export function CreateHost() {
  const { dialog, busy } = useCreate();
  if (dialog) return <CreateDialog mode={dialog} />;
  return busy ? <BusyOverlay /> : null;
}

/** 隐藏的文件选择框。「导入文件」按钮直接调它，不必先开对话框 */
export function useFilePicker() {
  const { fromFile } = useCreateArticle();
  return () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.onchange = () => void fromFile(input.files?.[0]);
    input.click();
  };
}

function CreateDialog({ mode }: { mode: CreateMode }) {
  const { busy, error, close, open } = useCreate();
  const { fromText, fromFile } = useCreateArticle();
  const pick = useFilePicker();
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const length = text.trim().length;
  const ready = length >= MIN_LENGTH;

  useEffect(() => {
    if (mode === 'paste') inputRef.current?.focus();
  }, [mode]);

  const submit = () => ready && !busy && void fromText(text);

  return (
    <Dialog onClose={close} width={640} label="新建图文">
      <div className="create-head">
        <div>
          <h3>新建图文</h3>
          <p>导入一篇长文，AI 会先写一版卡片初稿，再交给你逐页精修。</p>
        </div>
        <button type="button" className="icon-btn" aria-label="关闭" onClick={close} disabled={busy}>
          <Icon name="close" />
        </button>
      </div>

      {busy ? (
        <BusyBody />
      ) : (
        <>
          <div className="seg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'file'} onClick={() => open('file')}>
              <Icon name="upload" />
              导入文件
            </button>
            <button type="button" role="tab" aria-selected={mode === 'paste'} onClick={() => open('paste')}>
              <Icon name="doc" />
              粘贴正文
            </button>
          </div>

          {mode === 'file' ? (
            <button
              type="button"
              className={`dropzone${over ? ' is-over' : ''}`}
              onClick={pick}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                void fromFile(e.dataTransfer.files[0]);
              }}
            >
              <span className="dropzone-icon">
                <Icon name="upload" size={22} />
              </span>
              <strong>把 Markdown 文件拖到这里</strong>
              <span>
                或 <u>点击选择文件</u>，支持 .md / .markdown / .txt
              </span>
            </button>
          ) : (
            <div className="paste">
              <textarea
                ref={inputRef}
                className="paste-input"
                placeholder={'# 文章标题\n\n把公众号、博客的 Markdown 正文粘贴到这里…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
                }}
              />
              <div className="paste-foot">
                <span className={ready ? 'is-ok' : ''}>
                  {ready ? <Icon name="check" size={14} /> : null}
                  {length} 字{ready ? '' : `，至少 ${MIN_LENGTH} 字`}
                </span>
                <span>标题取自正文里的一级标题</span>
              </div>
            </div>
          )}

          {error ? (
            <div className="form-error" role="alert">
              <Icon name="warn" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="create-foot">
            <span>
              <Icon name="info" size={14} />
              文中配图会由服务端转存，公众号防盗链不影响导出
            </span>
            {mode === 'paste' ? (
              <button type="button" className="btn is-primary" disabled={!ready} onClick={submit}>
                <Icon name="generate" />
                开始生成
                <kbd>⌘↵</kbd>
              </button>
            ) : null}
          </div>
        </>
      )}
    </Dialog>
  );
}

const STEPS = ['解析正文结构', '转存文中配图', '进入编辑台，AI 开始写初稿'];

function BusyBody() {
  return (
    <div className="create-busy">
      <span className="create-busy-icon">
        <Spinner size={22} />
      </span>
      <strong>正在准备你的稿子</strong>
      <span>配图较多时需要多等一会儿，完成后会自动跳转</span>
      <ol>
        {STEPS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <i className="progress-bar" />
    </div>
  );
}

function BusyOverlay() {
  return (
    <div className="dlg-mask">
      <div className="dlg" style={{ width: 'min(440px, calc(100vw - 32px))' }}>
        <BusyBody />
      </div>
    </div>
  );
}
