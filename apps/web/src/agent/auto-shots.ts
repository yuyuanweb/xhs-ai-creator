import type { BlockPatch, LayoutSnapshot } from '@rcs/shared';

type SnapshotPage = LayoutSnapshot['pages'][number];

/** 短于这个字数、又排在页末的段落多半是「来源：…」那行小字，截图插在它前面才顺 */
const FOOTNOTE_MAX = 40;

/**
 * 给一张偏空、又没有图的页挑一张截图补上：只从这一章 sources 所在的原文节里挑，按原文顺序取第一张没用过的。
 * 模型修版时常常宁可扩写也不补图，而截图最撑版面、不用编字，所以先由代码补，补坏了再退回。
 *
 * skip 里是已经试过、补了反而更差的「页序号:图 id」
 */
export function nextShotPatch(snapshot: LayoutSnapshot, skip: Set<string>): { patch: BlockPatch; key: string } | null {
  const { report, pages, unusedImages } = snapshot;
  if (report.imagesUsed >= report.imagesMax) return null;

  const thin = new Set(report.thinPages);
  let sources: string[] = [];

  for (const page of pages) {
    for (const b of page.blocks) if (b.kind === 'h2') sources = b.sources ?? [];
    if (!thin.has(page.index) || page.overflow || page.blocks.some((b) => b.kind === 'image')) continue;

    const anchor = anchorOf(page);
    if (!anchor) continue;
    const shot = unusedImages.find((img) => sources.includes(img.source) && !skip.has(`${page.index}:${img.id}`));
    if (!shot) continue;

    return {
      key: `${page.index}:${shot.id}`,
      patch: { op: 'insert', blockId: anchor, block: { kind: 'image', imageId: shot.id, text: '' } },
    };
  }
  return null;
}

/** 插在本页最后一块后面；页末是一行来源小字时，插到它前面 */
function anchorOf(page: SnapshotPage): string | undefined {
  const blocks = page.blocks;
  const last = blocks[blocks.length - 1];
  if (!last) return undefined;
  const footnote = last.kind === 'p' && last.text.length <= FOOTNOTE_MAX && !last.text.endsWith('…');
  const before = blocks[blocks.length - 2];
  return footnote && before && before.kind !== 'h2' ? before.id : last.id;
}
