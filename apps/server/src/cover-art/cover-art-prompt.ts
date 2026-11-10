import type { CoverSpec } from '@rcs/shared';

export interface CoverArtContext {
  /** 印在图上的大字，已按行断好 */
  titleLines: string[];
  subject?: string;
  /** 用户另选的参考图张数，不含固定出镜人 */
  referenceCount: number;
  /** 参考图第一张是固定出镜人。需要人物时必须用他 */
  hostPortrait?: boolean;
  articleTitle: string;
  cover: CoverSpec;
}

/**
 * 最终提示词 = 提示词库里的风格要求 + 这一张的内容。
 * 风格要反复调，所以放提示词库；内容每篇不同，在这里拼
 */
export function buildCoverArtPrompt(style: string, ctx: CoverArtContext): string {
  const lines = [style.trim(), '', '### 这一张', '标题大字：', ...ctx.titleLines, ''];

  lines.push(
    ctx.subject?.trim()
      ? `画面主体：${ctx.subject.trim()}`
      : '画面主体：没有指定，从下面的文章信息里挑一个最能代表主题、最抓眼球的人物或物件。',
  );
  if (ctx.hostPortrait) {
    lines.push(
      '出镜人：参考图的第一张是固定出镜人。只要画面里出现人，就必须是他，保留五官、发型、肤色和年龄感；表情、手势、姿势和衣服按标题来换。不要换成别人，不要另找模特，也不要把他画成陌生人。画面主体是物件、界面或 Logo 时，不要把这个人画进去。',
    );
  }
  if (ctx.referenceCount) {
    lines.push(
      ctx.hostPortrait
        ? `其他参考图：出镜人之后还有 ${ctx.referenceCount} 张，用来照着画产品、界面或 Logo，文字不要搬到封面上。这些图里如果有别人，不要用他们替换出镜人。`
        : `参考图：附了 ${ctx.referenceCount} 张。画面主体以参考图为准：参考图里是人，就保留他的长相、发型、眼镜和穿着风格，让他做出符合标题情绪的表情；是产品、界面或 Logo，就照原样画出来。参考图里的文字不要搬到封面上。`,
    );
  }

  lines.push('', '文章信息（只用来理解主题，不要写到画面上）：', `- 文章标题：${ctx.articleTitle}`);
  lines.push(...coverHints(ctx.cover).map((h) => `- ${h}`));
  return lines.join('\n');
}

/** 排版封面上已经写好的引子和要点，是模型理解这篇讲什么最省事的线索 */
function coverHints(c: CoverSpec): string[] {
  const hints: string[] = [];
  if (c.kicker) hints.push(`引子：${plain(c.kicker)}`);
  if (c.lead) hints.push(`导语：${plain(c.lead)}`);
  const points = [...(c.points ?? []), ...(c.facts ?? []).map((f) => f.text), ...(c.chips ?? [])].map(plain).filter(Boolean);
  if (points.length) hints.push(`要点：${points.slice(0, 6).join('；')}`);
  return hints;
}

function plain(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/** 去掉空行和 ** 记号；模型常把换行写成字面量 \n */
export function splitTitleLines(title: string): string[] {
  return title
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\*\*/g, '').trim())
    .filter(Boolean);
}
