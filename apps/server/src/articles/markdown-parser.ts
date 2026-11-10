import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { BlockKind, SourceBlock } from '@rcs/shared';
import { newBlockId } from '../common/id';

export interface ParsedMarkdown {
  title: string;
  blocks: SourceBlock[];
  /** 出现过的图片原始地址，按首次出现顺序去重 */
  imageOrigins: string[];
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

/**
 * Markdown → 块流。
 * 块是排版的最小原子，所以段落内混排的图片会被拆成独立的 image 块，
 * 否则一段文字和它的截图无法被分页算法分别定位。
 */
export function parseMarkdown(markdown: string): ParsedMarkdown {
  const tokens = md.parse(markdown, {});
  const blocks: SourceBlock[] = [];
  const imageOrigins: string[] = [];
  const originIndex = new Map<string, number>();

  let seq = 0;
  let title = '';
  let section = '';
  let sub = '';

  const nextId = () => newBlockId(seq++);

  const registerImage = (src: string): string => {
    if (!originIndex.has(src)) {
      originIndex.set(src, imageOrigins.length);
      imageOrigins.push(src);
    }
    return `img${originIndex.get(src)}`;
  };

  const push = (kind: BlockKind, rest: Omit<SourceBlock, 'id' | 'kind'>) => {
    blocks.push({ id: nextId(), kind, section, sub, ...rest });
  };

  /** 段落里的图片单独成块，剩下的文字合成一个 p */
  const emitInline = (inline: Token) => {
    const images = (inline.children ?? []).filter((t) => t.type === 'image');
    const text = stripImages(inline.content).trim();

    if (text) push('p', { text });
    for (const img of images) {
      const src = img.attrGet('src');
      if (!src) continue;
      push('image', { imageId: registerImage(src), text: img.content || undefined });
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;

    switch (t.type) {
      case 'heading_open': {
        const inline = tokens[i + 1];
        const text = (inline?.content ?? '').trim();
        i += 2;
        if (!text) break;

        if (t.tag === 'h1') {
          if (!title) title = text;
        } else if (t.tag === 'h2') {
          section = text;
          sub = '';
          push('h2', { text });
        } else if (t.tag === 'h3') {
          sub = text;
          push('h3', { text });
        } else {
          push('p', { text });
        }
        break;
      }

      case 'paragraph_open': {
        const inline = tokens[i + 1];
        if (inline?.type === 'inline') emitInline(inline);
        i += 2;
        break;
      }

      case 'fence': {
        push('code', { code: t.content.replace(/\n$/, ''), lang: t.info.trim() || undefined });
        break;
      }

      case 'bullet_list_open':
      case 'ordered_list_open': {
        const kind: BlockKind = t.type === 'bullet_list_open' ? 'ul' : 'ol';
        const closing = t.type === 'bullet_list_open' ? 'bullet_list_close' : 'ordered_list_close';
        const items: string[] = [];

        let depth = 0;
        let j = i + 1;
        for (; j < tokens.length; j++) {
          const it = tokens[j]!;
          if (it.type === t.type) depth++;
          if (it.type === closing) {
            if (depth === 0) break;
            depth--;
          }
          if (it.type === 'inline' && depth === 0) {
            const text = stripImages(it.content).trim();
            if (text) items.push(text);
          }
        }
        if (items.length) push(kind, { items });
        i = j;
        break;
      }

      case 'blockquote_open': {
        const parts: string[] = [];
        let j = i + 1;
        for (; j < tokens.length && tokens[j]!.type !== 'blockquote_close'; j++) {
          if (tokens[j]!.type === 'inline') parts.push(tokens[j]!.content.trim());
        }
        const text = parts.join('\n').trim();
        if (text) push('quote', { text });
        i = j;
        break;
      }
    }
  }

  if (!title) title = firstMeaningfulLine(markdown) || '未命名文章';

  return { title, blocks, imageOrigins };
}

function stripImages(text: string): string {
  return text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
}

function firstMeaningfulLine(markdown: string): string {
  for (const line of markdown.split('\n')) {
    const t = line.replace(/^#+\s*/, '').trim();
    if (t) return t.slice(0, 80);
  }
  return '';
}
