import {
  CARD_BLOCK_KINDS,
  groundedCaption,
  hasContent,
  imageUnits,
  isCoreUnit,
  isShot,
  tidyBlock,
  unfoldNewlines,
  type CardBlock,
  type CardBlockKind,
  type SourceArticle,
  type SourceUnit,
} from '@rcs/shared';
import { newBlockId } from '../common/id';

export type RawBlock = Partial<CardBlock> & { kind: CardBlockKind };

/**
 * 把模型给的块收成正式块。初稿和补章各调一次，共用 id 序号和「用过的截图」，
 * 所以补出来的块不会和初稿撞 id，也不会把初稿用过的图再用一遍。
 *
 * 截图的硬规则都在这里：只认原文里够大的截图，同一张图只留第一次，不许两张图连着放，
 * 不许放进 sources 不含它原文所在节的章节，图注里有原文找不到的名称和数字就清空。
 */
export class DraftBlocks {
  private seq = 0;
  private readonly picked = new Set<string>();
  private readonly takenIds: Set<string>;
  private readonly usable: Set<string>;
  private readonly unitIds: Set<string>;
  private readonly imageUnit: Map<string, string>;

  /** existing 是已经落库的块：给一份现成的稿子补章时，新块要避开它们的 id 和用过的截图 */
  constructor(
    private readonly article: SourceArticle,
    readonly units: SourceUnit[],
    existing: CardBlock[] = [],
  ) {
    this.usable = new Set(article.images.filter(isShot).map((i) => i.id));
    this.unitIds = new Set(units.map((u) => u.id));
    this.imageUnit = imageUnits(units);
    this.takenIds = new Set(existing.map((b) => b.id));
    for (const b of existing) if (b.kind === 'image' && b.imageId) this.picked.add(b.imageId);
  }

  normalize(raw: RawBlock[] | undefined): CardBlock[] {
    const out: CardBlock[] = [];
    let chapterSources: string[] | undefined;

    for (const b of raw ?? []) {
      if (!CARD_BLOCK_KINDS.includes(b.kind)) continue;
      if (b.kind === 'image' && !this.acceptImage(b.imageId, out[out.length - 1], chapterSources)) continue;

      const text = b.kind === 'image' ? (groundedCaption(b.text, this.article.markdown) ?? '') : b.text;
      const tidy = tidyBlock({ ...b, text: text && b.kind !== 'code' ? unfoldNewlines(text) : text });
      if (!hasContent(tidy)) continue;

      const { breakHint, sources, ...fields } = tidy;
      const known = sources?.filter((s) => this.unitIds.has(s));
      if (b.kind === 'h2') chapterSources = known?.length ? known : undefined;
      if (b.kind === 'image') this.picked.add(b.imageId!);

      out.push({
        ...fields,
        id: this.nextId(),
        kind: fields.kind ?? b.kind,
        ...(known?.length ? { sources: known } : {}),
        ...(breakHint === 'break' || breakHint === 'join' ? { breakHint } : {}),
      });
    }
    return out;
  }

  /**
   * 原文里的核心节有哪些没被任何 h2 认领。
   * 模型漏写 sources 的章节，按它用到的截图推断讲的是哪一节；写了 sources 的以 sources 为准，
   * 否则一张截图挂在别的章节里也会被当成「这一节讲过了」
   */
  uncovered(blocks: CardBlock[]): SourceUnit[] {
    const covered = new Set<string>();
    for (const chapter of chaptersOf(blocks)) {
      const declared = chapter[0]!.kind === 'h2' ? chapter[0]!.sources : undefined;
      const claimed = declared?.length
        ? declared
        : chapter.flatMap((b) => (b.kind === 'image' && b.imageId ? [this.imageUnit.get(b.imageId) ?? ''] : []));
      claimed.forEach((id) => covered.add(id));
    }
    return this.units.filter((u) => isCoreUnit(u) && !covered.has(u.id));
  }

  private nextId(): string {
    let id: string;
    do id = newBlockId(this.seq++);
    while (this.takenIds.has(id));
    this.takenIds.add(id);
    return id;
  }

  private acceptImage(imageId: string | undefined, prev: CardBlock | undefined, chapterSources: string[] | undefined) {
    if (!imageId || !this.usable.has(imageId) || this.picked.has(imageId)) return false;
    if (prev?.kind === 'image') return false;
    const unit = this.imageUnit.get(imageId);
    return !chapterSources || !unit || chapterSources.includes(unit);
  }
}

/**
 * 补写的章节按原文顺序插回初稿。章节的位置由它 sources 里最靠前的那一节决定，
 * 没写 sources 的章节跟着它前面那一章走，开篇那几块不属于任何 h2，永远排最前
 */
export function mergeChapters(base: CardBlock[], extra: CardBlock[], units: SourceUnit[]): CardBlock[] {
  const order = new Map(units.map((u, i) => [u.id, i]));
  const keyed = (blocks: CardBlock[]) => {
    let last = -1;
    return chaptersOf(blocks).map((chapter) => {
      const head = chapter[0]!;
      const own = head.kind === 'h2' ? (head.sources ?? []).map((s) => order.get(s) ?? Infinity) : [];
      last = own.length ? Math.min(...own) : last;
      return { chapter, key: last };
    });
  };

  return [...keyed(base), ...keyed(extra)]
    .map((c, i) => ({ ...c, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .flatMap((c) => c.chapter);
}

function chaptersOf(blocks: CardBlock[]): CardBlock[][] {
  const chapters: CardBlock[][] = [];
  for (const b of blocks) {
    if (b.kind === 'h2' || !chapters.length) chapters.push([b]);
    else chapters[chapters.length - 1]!.push(b);
  }
  return chapters;
}
