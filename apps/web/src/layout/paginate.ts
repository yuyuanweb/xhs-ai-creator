import { COMPONENT_KINDS, CONTENT_H, MIN_FILL, type CardBlock, type LayoutPage } from '@rcs/shared';
import type { Measurements } from '../render/Measurer';
import { plainText } from '../render/inline';

/** 需要跟上文绑在一起的块：图片跟着说明文字，列表和组件跟着引导句，代码跟着上文 */
const ATTACHES_UP = new Set<CardBlock['kind']>(['image', 'code', 'ul', 'ol', 'quote', ...COMPONENT_KINDS]);

/** 差一点装不下时，图片最多缩到原高的 78% */
const SHRINK_MAX = 0.22;
/** 整组超过一页时才允许缩得更狠，且不得压进页脚 */
const SHRINK_MAX_OVERSIZED = 0.36;

/**
 * CONTENT_H 已经扣掉了页脚和它上面的间距，这里只扣 .c-body 的 12px 下内边距，再留几像素吸收测高的小数误差。
 * 页末块的下边距渲染时会清零，装箱按 tails 扣掉，不再靠这里多留余量
 */
const PACK_H = CONTENT_H - 16;

/** 低于这个填充率就要从邻页借内容过来。按装箱高换算，与体检的 MIN_FILL 同一条线 */
const TOO_THIN = (MIN_FILL * CONTENT_H) / PACK_H;
const NEARLY_EMPTY = 0.5;
const REBALANCE_TARGET = 0.86;
const REBALANCE_CEILING = 0.96;

/** 放大图片时给测高的小数误差留的余量 */
const GROW_SLACK = 2;

interface Stack {
  height: number;
  /** 最后一块的下边距，排在页末时不占高度 */
  tail: number;
}

interface Group extends Stack {
  blocks: CardBlock[];
  forceBreak: boolean;
  preferBreak: boolean;
}

interface Placed extends Stack {
  blocks: CardBlock[];
}

/** 一串块排在一页上真正占的高度 */
function netHeight(items: Stack[]): number {
  return items.reduce((sum, x) => sum + x.height, 0) - (items[items.length - 1]?.tail ?? 0);
}

/**
 * 把块流切成不可分割的组。
 * 这里是「说明文字和它的截图不能分到两页」的实现处：
 * 一段文字和紧跟它的图片是一个原子，分页时只能整体移动。
 */
function buildGroups(blocks: CardBlock[], m: Measurements): Group[] {
  const groups: Group[] = [];
  const open = (b: CardBlock, forceBreak = false, preferBreak = forceBreak) => {
    groups.push({ blocks: [b], height: m.heights[b.id] ?? 0, tail: m.tails[b.id] ?? 0, forceBreak, preferBreak });
  };
  const join = (g: Group, b: CardBlock) => {
    g.blocks.push(b);
    g.height += m.heights[b.id] ?? 0;
    g.tail = m.tails[b.id] ?? 0;
  };

  for (const b of blocks) {
    const last = groups[groups.length - 1];
    const lastKind = last?.blocks[last.blocks.length - 1]?.kind;

    // 一页一个大标题：章节标题总是开新页，除非模型明确要求并进上一页
    if (b.kind === 'h2') {
      open(b, opensChapter(b));
      continue;
    }

    // 截图上的 break 不认：图一旦和说明文字分页，读者就不知道这张图在说什么。
    // 紧跟标题的 break 也不认：标题本来就开新页，再断一次只会把标题和正文拆开
    const afterHeading = lastKind === 'h2' || lastKind === 'h3';
    if (b.breakHint === 'break' && b.kind !== 'image' && !afterHeading) {
      open(b, false, true);
      continue;
    }

    if (b.breakHint === 'join' && last) {
      join(last, b);
      continue;
    }

    if (b.kind === 'h3') {
      if (last && last.blocks.every((x) => isHeading(x))) join(last, b);
      else open(b, false, true);
      continue;
    }

    // 标题带着后面的正文和图走，避免标题自己落在页底
    if (last && isHeading(last.blocks[0]) && last.blocks.length < 4 && !isHeading(b)) {
      join(last, b);
      continue;
    }

    // 标题永不落单：紧跟标题的第一块必须同组
    if (last && afterHeading) {
      join(last, b);
      continue;
    }

    if (ATTACHES_UP.has(b.kind) && last && lastKind === 'p') {
      join(last, b);
      continue;
    }

    open(b);
  }

  return groups;
}

export function paginate(blocks: CardBlock[], m: Measurements): LayoutPage[] {
  const groups = buildGroups(blocks, m);
  const pages: Placed[][] = [];
  const scales: Record<string, number> = {};
  const overflowPages = new Set<number>();

  let current: Placed[] = [];
  /** 当前页已放内容的总高，含最后一块的下边距：再往后接块时它就是块间距 */
  let currentH = 0;
  let overflow = false;

  const flush = () => {
    if (!current.length) return;
    if (overflow) overflowPages.add(pages.length);
    pages.push(current);
    current = [];
    currentH = 0;
    overflow = false;
  };

  const place = (bs: CardBlock[], height: number, tail: number) => {
    current.push({ blocks: bs, height, tail });
    currentH += height;
  };

  /** 把组内图片等比缩小到能装进给定高度，返回缩完的组高；缩不进返回 undefined */
  const shrinkToFit = (g: Group, available: number, limit: number): number | undefined => {
    const imgs = g.blocks.filter((b) => b.kind === 'image');
    const imgH = imgs.reduce((sum, b) => sum + (m.pictures[b.id] ?? 0), 0);
    const need = netHeight([g]) - available;
    if (imgH <= 0 || need / imgH > limit) return undefined;

    const k = 1 - need / imgH;
    imgs.forEach((b) => (scales[b.id] = k));
    return g.height - need;
  };

  for (const g of groups) {
    const net = netHeight([g]);

    if (current.length) {
      const remain = PACK_H - currentH;
      const orphanHeading = headingOnly(g);
      const mustBreak = g.forceBreak || net > remain || orphanHeading;

      // 差一点装不下时先试着缩图塞进当页，而不是把整组推走、留下一个半空页
      if (mustBreak && !g.forceBreak && !orphanHeading && remain > PACK_H * 0.28) {
        const shrunk = shrinkToFit(g, remain, SHRINK_MAX);
        if (shrunk !== undefined) {
          place(g.blocks, shrunk, g.tail);
          continue;
        }
      }
      if (mustBreak) flush();
    }

    if (net > PACK_H) {
      // 整组超过一整页：先争取缩图保住图文同页，实在不行才拆开
      const shrunk = shrinkToFit(g, PACK_H, SHRINK_MAX_OVERSIZED);
      if (shrunk !== undefined) {
        flush();
        place(g.blocks, shrunk, g.tail);
        flush();
        continue;
      }

      for (let i = 0; i < g.blocks.length; i++) {
        const b = g.blocks[i]!;
        const bh = m.heights[b.id] ?? 0;
        const bt = m.tails[b.id] ?? 0;
        const restH = g.blocks.slice(i).reduce((sum, x) => sum + (m.heights[x.id] ?? 0), 0);
        // 标题必须带着后面的内容走，装不下就整组换页，不要标题自己垫在页底
        if (current.length && isHeading(b) && currentH + Math.min(restH, PACK_H) > PACK_H) flush();
        else if (current.length && currentH + bh - bt > PACK_H) flush();
        place([b], bh, bt);
        if (currentH - bt > PACK_H) {
          overflow = currentH - bt > CONTENT_H;
          flush();
        }
      }
      continue;
    }

    place(g.blocks, g.height, g.tail);
  }
  flush();

  let packed = compact(pages, overflowPages, m.pictures, scales);
  rebalance(packed.pages);
  liftTrailingHeadings(packed.pages);
  packed = compact(packed.pages, packed.overflow, m.pictures, scales);
  liftTrailingHeadings(packed.pages);
  growImages(packed.pages, packed.overflow, m, scales);

  // 页眉章节名和章号跟着正文里最近的 h2 走。块上的 section 由模型填写，续页常常标错
  let chapter = '';
  let chapterNo = 0;
  return packed.pages.map((placed, i) => {
    const pageBlocks = placed.flatMap((p) => p.blocks);
    const first = pageBlocks[0];
    const pageScales: Record<string, number> = {};
    for (const b of pageBlocks) {
      const s = scales[b.id];
      if (s !== undefined && s !== 1) pageScales[b.id] = s;
    }

    const opens = first !== undefined && first.kind === 'h2';
    const section = (opens ? sectionOf(first) : '') || chapter || pageBlocks.find((b) => b.section)?.section || '';
    const pageChapter = opens ? chapterNo + 1 : chapterNo;
    for (const b of pageBlocks) {
      if (b.kind !== 'h2') continue;
      chapter = sectionOf(b) || chapter;
      chapterNo++;
    }

    return {
      index: i,
      blockIds: pageBlocks.map((b) => b.id),
      section,
      ...(pageChapter > 0 ? { chapter: pageChapter } : {}),
      continued: first?.kind !== 'h2' && first?.kind !== 'h3',
      fill: netHeight(placed) / CONTENT_H,
      overflow: packed.overflow.has(i),
      ...(Object.keys(pageScales).length ? { imageScales: pageScales } : {}),
    };
  });
}

/** 相邻两页加起来都装得下，就并成一页，避免每节一张半空卡 */
function compact(
  pages: Placed[][],
  overflowPages: Set<number>,
  pictures: Record<string, number>,
  scales: Record<string, number>,
): { pages: Placed[][]; overflow: Set<number> } {
  const out: Placed[][] = [];
  const overflow = new Set<number>();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const last = out[out.length - 1];
    const lastOverflow = last !== undefined && overflow.has(out.length - 1);
    const thisOverflow = overflowPages.has(i);
    const orphanOnMerge = last && last.length > 0 && headingOnly(page[0]) && page.length === 1;

    if (last && !lastOverflow && !thisOverflow && !orphanOnMerge) {
      const combined = netHeight([...last, ...page]);
      if (startsChapter(page)) {
        // 章节页本该独占一页，但两章都只有半页时，并成一页比留两张半空卡强
        if (isThin(last) && isThin(page) && combined <= PACK_H) {
          last.push(...page);
          continue;
        }
      } else {
        if (combined <= PACK_H) {
          last.push(...page);
          continue;
        }
        // 两页都有截图时只许轻缩，缩狠了一页挤两张小图反而看不清
        const limit = hasImage(last) && hasImage(page) ? SHRINK_MAX : SHRINK_MAX_OVERSIZED;
        if (combined <= PACK_H * 1.1 && shrinkPair(last, page, pictures, scales, limit)) {
          last.push(...page);
          continue;
        }
      }
    }

    if (thisOverflow) overflow.add(out.length);
    out.push(page);
  }

  return { pages: out, overflow };
}

/** 相邻两页都偏空时，缩图并成一页 */
function shrinkPair(
  a: Placed[],
  b: Placed[],
  pictures: Record<string, number>,
  scales: Record<string, number>,
  limit: number,
): boolean {
  const items = [...a, ...b];
  const pictureOf = (p: Placed) =>
    p.blocks.reduce((sum, x) => sum + (x.kind === 'image' ? (pictures[x.id] ?? 0) * (scales[x.id] ?? 1) : 0), 0);
  const imgH = items.reduce((sum, p) => sum + pictureOf(p), 0);
  const need = netHeight(items) - PACK_H;
  if (imgH <= 0 || need <= 0 || need / imgH > limit) return false;

  const k = 1 - need / imgH;
  for (const p of items) {
    p.height -= pictureOf(p) * (1 - k);
    for (const x of p.blocks) if (x.kind === 'image') scales[x.id] = (scales[x.id] ?? 1) * k;
  }
  return true;
}

/**
 * 页间均衡：过空的页先从上一页「借」末尾，还不够再把下一页开头提上来。
 * 不做这一步就会出现「一句话独占一页」，连续翻页时非常业余。
 */
function rebalance(pages: Placed[][]) {
  const ratio = (items: Placed[]) => netHeight(items) / PACK_H;
  const fits = (items: Placed[]) => ratio(items) <= REBALANCE_CEILING;

  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i]!;
    if (ratio(page) >= TOO_THIN) continue;

    // 邻页至少留一组，不能借空；本页以章节标题开头时，上一章的内容不能垫到标题上面
    const prev = startsChapter(page) ? undefined : pages[i - 1];
    while (prev && prev.length > 1 && ratio(page) < REBALANCE_TARGET) {
      const last = prev[prev.length - 1]!;
      if (!fits([last, ...page])) break;
      // 本页只是略空时，不值得把上一页借成新的空页
      if (ratio(page) >= NEARLY_EMPTY && ratio(prev.slice(0, -1)) < TOO_THIN) break;
      prev.pop();
      page.unshift(last);
    }

    // 往前提不能把下一页掏空，也不能把下一节的标题提到本页末尾
    const next = pages[i + 1];
    while (next && next.length > 1 && ratio(page) < TOO_THIN) {
      const first = next[0]!;
      if (headingOnly(first) || first.blocks[0]?.kind === 'h2' || !fits([...page, first])) break;
      if (ratio(next.slice(1)) < TOO_THIN) break;
      next.shift();
      page.push(first);
    }
  }
}

/**
 * 分页落定后，用每页剩下的余量把图放大：先把为了挤进来缩过的图放回原大，
 * 再把被高度上限卡窄的截图拉到和正文齐宽。只吃余量，不会把任何块挤出本页。
 */
function growImages(pages: Placed[][], overflow: Set<number>, m: Measurements, scales: Record<string, number>) {
  pages.forEach((page, i) => {
    if (overflow.has(i)) return;
    let spare = PACK_H - netHeight(page) - GROW_SLACK;

    for (const p of page) {
      for (const b of p.blocks) {
        const picture = m.pictures[b.id];
        if (spare <= 0) return;
        if (b.kind !== 'image' || !picture) continue;

        const now = scales[b.id] ?? 1;
        const add = Math.min(spare, picture * (Math.max(1, m.grows[b.id] ?? 1) - now));
        if (add <= 0) continue;
        scales[b.id] = now + add / picture;
        p.height += add;
        spare -= add;
      }
    }
  });
}

/** 页末只剩光杆标题时挪到下一页，标题下面还有正文的不动 */
function liftTrailingHeadings(pages: Placed[][]) {
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    while (page.length > 1 && headingOnly(page[page.length - 1])) {
      const last = page.pop()!;
      const next = pages[i + 1];
      if (next) next.unshift(last);
      else pages.push([last]);
    }
  }
}

function sectionOf(h2: CardBlock): string {
  return h2.section || plainText(h2.text ?? '').replace(/\s*\n\s*/g, ' ');
}

function opensChapter(b: CardBlock | undefined): boolean {
  return b?.kind === 'h2' && b.breakHint !== 'join';
}

/** 这一页是不是从一个独占页首的章节标题开始。这种页不能和上一页合并，也不能从上一页借内容垫在标题上面 */
function startsChapter(page: Placed[] | undefined): boolean {
  return opensChapter(page?.[0]?.blocks[0]);
}

function isHeading(b: CardBlock | undefined): boolean {
  return b?.kind === 'h2' || b?.kind === 'h3';
}

function headingOnly(g: Group | Placed | undefined): boolean {
  return Boolean(g?.blocks.length && g.blocks.every((b) => isHeading(b)));
}

function isThin(page: Placed[]): boolean {
  return netHeight(page) / PACK_H < TOO_THIN;
}

function hasImage(page: Placed[]): boolean {
  return page.some((p) => p.blocks.some((b) => b.kind === 'image'));
}
