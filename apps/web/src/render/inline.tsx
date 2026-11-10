import type { ReactNode } from 'react';

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]*\))/g;

/** 行内 Markdown：加粗走荧光笔、行内代码走浅底、链接只留文字。卡片上放不下真实链接，留着也点不了 */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];

  text.split(TOKEN).forEach((part, i) => {
    if (!part) return;

    if (part.startsWith('**') && part.endsWith('**')) {
      out.push(
        <strong key={i} className="c-strong">
          {part.slice(2, -2)}
        </strong>,
      );
      return;
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      out.push(
        <code key={i} className="c-icode">
          {part.slice(1, -1)}
        </code>,
      );
      return;
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]*)\)$/);
    out.push(link ? <span key={i} className="c-link">{link[1]}</span> : part);
  });

  return out;
}

export function plainText(text = ''): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

/** 中文按一格、英文数字按半格估宽，用于封面标题的字号预算 */
export function visualWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.5;
  return w;
}
