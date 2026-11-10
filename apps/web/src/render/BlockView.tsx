import type { CSSProperties } from 'react';
import { COMPONENT_KINDS, CONTENT_W, IMAGE_MAX_H, IMAGE_MAX_UPSCALE, type CardBlock, type ComponentKind, type SourceImage } from '@rcs/shared';
import { ComponentBlock } from './ComponentBlock';
import { InlineField, InlineList } from './edit-fields';
import { renderInline } from './inline';

export interface BlockLive {
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onText?: (text: string) => void;
  onItems?: (items: string[]) => void;
  onCode?: (code: string) => void;
  /** 组件块这类多字段的改动 */
  onPatch?: (patch: Partial<CardBlock>) => void;
}

export interface BlockViewProps {
  block: CardBlock;
  images: Map<string, SourceImage>;
  /** 为了塞进当前页而施加的缩放系数 */
  scale?: number;
  live?: BlockLive;
}

export function BlockView({ block: b, images, scale = 1, live }: BlockViewProps) {
  if (COMPONENT_KINDS.includes(b.kind as ComponentKind)) return <ComponentBlock block={b} live={live} />;

  switch (b.kind) {
    case 'h2':
      return textBlock('b-h2', b.text ?? '', 'newline', live);
    case 'h3':
      return textBlock('b-h3', b.text ?? '', 'commit', live);
    case 'p':
      return textBlock('b-p', b.text ?? '', 'newline', live);
    case 'quote':
      return textBlock('b-quote', b.text ?? '', 'newline', live);

    case 'ul':
    case 'ol':
      if (live?.onItems) {
        return (
          <InlineList
            items={b.items ?? []}
            ordered={b.kind === 'ol'}
            selected={live.selected}
            disabled={live.disabled}
            onSelect={live.onSelect}
            onCommit={live.onItems}
          />
        );
      }
      return b.kind === 'ol' ? (
        <ol className="b-list b-ol">
          {(b.items ?? []).map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ol>
      ) : (
        <ul className="b-list b-ul">
          {(b.items ?? []).map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );

    case 'code':
      if (live?.onCode) {
        return (
          <div className={`b-code${live.selected ? ' is-on' : ''}`} onClick={(e) => e.stopPropagation()}>
            {b.lang ? <div className="b-lang">{b.lang}</div> : null}
            <pre>
              <InlineField
                className="b-code-edit"
                value={b.code ?? ''}
                enterMode="newline"
                plain
                selected={live.selected}
                disabled={live.disabled}
                onSelect={live.onSelect}
                onCommit={live.onCode}
              />
            </pre>
          </div>
        );
      }
      return (
        <div className="b-code">
          {b.lang ? <div className="b-lang">{b.lang}</div> : null}
          <pre>
            <code>{b.code}</code>
          </pre>
        </div>
      );

    case 'image': {
      const img = b.imageId ? images.get(b.imageId) : undefined;
      if (!img?.url) return null;
      const caption = shotCaption(b.text);
      return (
        <figure
          className={`b-img${live ? ' is-editable' : ''}${live?.selected ? ' is-on' : ''}`}
          onClick={
            live
              ? (e) => {
                  e.stopPropagation();
                  if (!live.disabled) live.onSelect?.();
                }
              : undefined
          }
        >
          <img src={img.url} alt={caption ?? ''} style={imageStyle(img.width, img.height, scale)} />
          {caption ? <figcaption className="b-cap">{caption}</figcaption> : null}
        </figure>
      );
    }

    default:
      return null;
  }
}

function textBlock(className: string, value: string, enterMode: 'newline' | 'commit', live?: BlockLive) {
  if (!live?.onText) {
    const Tag = className === 'b-h2' ? 'h2' : className === 'b-h3' ? 'h3' : className === 'b-quote' ? 'div' : 'p';
    return <Tag className={className}>{renderInline(value)}</Tag>;
  }
  return (
    <InlineField
      className={className}
      value={value}
      enterMode={enterMode}
      selected={live.selected}
      disabled={live.disabled}
      onSelect={live.onSelect}
      onCommit={live.onText}
    />
  );
}

/**
 * 图注取自 image 块的 text。Markdown 的 alt 多半是文件名或空串，
 * 这种当图注印在卡片上只会露怯，宁可不要。
 */
function shotCaption(text: string | undefined): string | undefined {
  // 模型偶尔自己在前面写上「图注：」，印在图下面就成了一句废话
  const value = text?.trim().replace(/^(图注|图说|说明)\s*[:：]\s*/, '');
  if (!value || value.length < 4) return undefined;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(value)) return undefined;
  return value;
}

/**
 * 宽度上限有两条：小图不放大超过原始像素的 1.6 倍，否则会拉成马赛克；
 * 偏方的图按高度上限倒推宽度，不能靠 max-height 去截——那样盒子仍是满宽、图在里面留边，
 * 看着和正文对不齐，而且缩放后的高度不再和比例成正比，分页会算错。
 * 页面有余量时分页会给出大于 1 的系数，把卡在高度上限的图放大，这时高度上限也要跟着解开
 */
function imageStyle(naturalWidth: number, naturalHeight: number, scale: number): CSSProperties | undefined {
  const byPixels = naturalWidth ? naturalWidth * IMAGE_MAX_UPSCALE : CONTENT_W;
  const byHeight = naturalWidth && naturalHeight ? (IMAGE_MAX_H * naturalWidth) / naturalHeight : CONTENT_W;
  const cap = Math.round(Math.min(CONTENT_W, byPixels, byHeight));
  const unclamp = scale > 1 ? { maxHeight: 'none' } : {};

  if (cap < CONTENT_W) return { width: `min(calc(var(--img-w, 100%) * ${scale}), ${Math.round(cap * scale)}px)`, ...unclamp };
  if (scale !== 1) return { width: `calc(var(--img-w, 100%) * ${scale})`, ...unclamp };
  return undefined;
}
