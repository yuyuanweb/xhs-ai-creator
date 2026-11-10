import { isCoreUnit, isShot, sourceUnits, type SourceArticle, type SourceUnit } from '@rcs/shared';

/**
 * 把原文压成给模型看的紧凑文本。
 * 不用 JSON 是因为同样的信息 JSON 要多花近一倍的 token，而模型读这种带标记的行式文本同样准确。
 * 图片一行里带上 id 和原始尺寸，模型据此判断它在版面上会占多大地方。
 * 表情包这类小图直接不给模型看：它看不到画面，给了就会被当成截图配上编出来的图注。
 * 每一节开头标上节号，末尾再列一遍章节清单：长文的后半部分模型最容易草草略过，有清单才能逐节对账。
 */
export function renderArticleContext(article: SourceArticle): string {
  const imageById = new Map(article.images.map((img) => [img.id, img]));
  const units = sourceUnits(article.blocks);
  const unitStarts = new Map(units.map((u) => [u.blockIds[0], u]));
  const lines: string[] = [`标题：${article.title}`, ''];

  for (const b of article.blocks) {
    const unit = unitStarts.get(b.id);
    if (unit) lines.push(`〔${unit.id}｜${unitLabel(unit)}〕`);

    switch (b.kind) {
      case 'image': {
        const img = b.imageId ? imageById.get(b.imageId) : undefined;
        if (!isShot(img)) break;
        // 模型看不到图，没有图说时要明确告诉它，否则它会照着上下文编一个
        const alt = b.text ? ` ${b.text}` : ' （原文没给图说）';
        lines.push(`[${b.kind}|${img.id}|${img.width}x${img.height}]${alt}`);
        break;
      }
      case 'ul':
      case 'ol':
        lines.push(`[${b.kind}] ${(b.items ?? []).join(' / ')}`);
        break;
      case 'code':
        lines.push(`[code|${b.lang ?? ''}] ${truncate(b.code ?? '', 400)}`);
        break;
      default:
        lines.push(`[${b.kind}] ${b.text ?? ''}`);
    }
  }

  const usable = article.images.filter(isShot);
  lines.push('', `可用配图：${usable.length ? usable.map((i) => i.id).join('、') : '无'}`);
  lines.push('', '原文章节清单（标「核心」的每一节都必须被某个 h2 的 sources 覆盖）：');
  lines.push(...units.map((u) => `${u.id} ${u.title}（${unitLabel(u)}）`));

  return lines.join('\n');
}

function unitLabel(u: SourceUnit): string {
  const parts = [`约 ${u.chars} 字`];
  if (u.imageIds.length) parts.push(`${u.imageIds.length} 张图`);
  parts.push(isCoreUnit(u) ? '核心' : '可略');
  return parts.join('，');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…（代码已截断）`;
}
