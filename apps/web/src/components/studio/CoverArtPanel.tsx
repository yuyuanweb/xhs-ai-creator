import { useState } from 'react';
import { isCoverArt, isUploadImage, type CoverSpec, type SourceArticle, type SourceImage } from '@rcs/shared';
import type { CoverArt } from '../../editor/useCoverArt';
import { errorText, toast } from '../../ui/feedback';
import { Icon } from '../../ui/icons';
import { ImagePeek } from '../../ui/ImagePeek';
import { Spinner } from '../../ui/Logo';

const MAX_REFERENCES = 3;
const REF_ACCEPT = 'image/png,image/jpeg,image/webp';
const REF_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * 让 AI 画一张 3:4 封面图：上面一两行大字，下面一个突出的主体。
 * 画好的几张都留在这里，随时换着用，也能切回排版封面
 */
export function CoverArtPanel({
  cover,
  images,
  disabled,
  art,
  onUpload,
}: {
  cover: CoverSpec;
  images: SourceImage[];
  disabled: boolean;
  art: CoverArt;
  onUpload?: (file: File) => Promise<SourceArticle | void>;
}) {
  const [title, setTitle] = useState(() => cover.title.replace(/\*\*/g, ''));
  const [subject, setSubject] = useState('');
  const [refs, setRefs] = useState<string[]>([]);
  const [peek, setPeek] = useState<SourceImage | null>(null);
  const [uploading, setUploading] = useState(false);

  const drawn = images.filter(isCoverArt).reverse();
  // 自己上传的多半是本人照片或产品图，排在原文配图前面
  const candidates = [...images.filter(isUploadImage), ...images.filter((img) => !isUploadImage(img) && !isCoverArt(img))];
  const busy = disabled || art.generating || uploading;
  const showRefs = Boolean(onUpload) || candidates.length > 0;

  const toggleRef = (id: string) =>
    setRefs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_REFERENCES ? [...prev, id] : prev));

  const addFile = async (file: File) => {
    if (!onUpload) return;
    if (!REF_MIMES.has(file.type)) {
      toast.error('参考图只支持 PNG、JPEG、WebP');
      return;
    }
    setUploading(true);
    try {
      const known = new Set(images.map((img) => img.id));
      const next = await onUpload(file);
      const added = next?.images.find((img) => isUploadImage(img) && !known.has(img.id));
      if (added) {
        setRefs((prev) => (prev.includes(added.id) || prev.length >= MAX_REFERENCES ? prev : [...prev, added.id]));
      }
    } catch (err) {
      toast.error(errorText(err, '上传失败'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="pane-sec">
      <h3>AI 封面图</h3>
      <div className="field-list">
        <label>
          <span>封面大字</span>
          <textarea
            className="nick-field"
            rows={2}
            value={title}
            disabled={busy}
            placeholder={'比如：\nAI 编程\n有手就行'}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          <span>画面主体（选填）</span>
          <textarea
            className="nick-field"
            rows={2}
            value={subject}
            disabled={busy}
            placeholder="比如：戴眼镜的程序员瞪大眼睛看着屏幕。不填就按文章内容自己挑"
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
      </div>
      <p className="pane-hint">大字越短越醒目，两行以内、每行 2 到 6 个字。画面是标题在上、主体在下。配置了固定出镜人时，画面里的人物会用这张脸。</p>

      {showRefs ? (
        <>
          <div className="pane-sub">
            参考图（选填）<span>{refs.length} / {MAX_REFERENCES}</span>
          </div>
          <div className="picks is-scroll">
            {onUpload ? (
              <label className={`pick is-add${busy ? ' is-off' : ''}`} title="上传参考图">
                <input
                  type="file"
                  accept={REF_ACCEPT}
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void addFile(file);
                  }}
                />
                {uploading ? <Spinner size={14} /> : <Icon name="upload" size={14} />}
                <span>{uploading ? '上传中' : '上传'}</span>
              </label>
            ) : null}
            {candidates.map((img) => (
              <RefPick
                key={img.id}
                img={img}
                selected={refs.includes(img.id)}
                disabled={busy}
                onPeek={() => setPeek(img)}
                onToggle={() => toggleRef(img.id)}
              />
            ))}
          </div>
          <p className="pane-hint">点图放大看细节，勾选用作参考。也可自己上传产品、界面或 Logo。</p>
        </>
      ) : null}

      <button
        type="button"
        className="btn is-primary art-go"
        disabled={busy || !title.trim()}
        onClick={() => void art.generate({ title, ...(subject.trim() ? { subject } : {}), referenceIds: refs })}
      >
        {art.generating ? <Spinner size={14} /> : <Icon name="generate" />}
        {art.generating ? '正在画，大约半分钟' : '生成封面图'}
      </button>

      {drawn.length ? (
        <>
          <div className="pane-sub">
            画好的封面<span>点一张换上</span>
          </div>
          <div className="picks is-portrait">
            {drawn.map((img) => (
              <button
                key={img.id}
                type="button"
                className={img.id === cover.imageId ? 'is-on' : ''}
                disabled={disabled}
                title={img.alt}
                onClick={() => art.apply(img.id)}
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
          {cover.imageId ? (
            <div className="pane-acts">
              <button type="button" className="act" disabled={disabled} onClick={() => art.apply()}>
                <Icon name="reset" />
                用回排版封面
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {peek ? <ImagePeek src={peek.url} alt={peek.alt} onClose={() => setPeek(null)} /> : null}
    </section>
  );
}

function RefPick({
  img,
  selected,
  disabled,
  onPeek,
  onToggle,
}: {
  img: SourceImage;
  selected: boolean;
  disabled: boolean;
  onPeek: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`pick${selected ? ' is-on' : ''}`}>
      <button type="button" className="pick-face" disabled={disabled} title={img.alt || img.id} onClick={onPeek}>
        <img src={img.url} alt="" />
      </button>
      <button
        type="button"
        className="pick-check"
        aria-label={selected ? '取消选用' : '选为参考图'}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onToggle}
      >
        {selected ? (
          <svg viewBox="0 0 12 12" width="8" height="8" aria-hidden>
            <path d="M2.3 6.2 5 8.8 9.7 3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>
    </div>
  );
}
