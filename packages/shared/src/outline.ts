import type { SourceBlock } from './types/source.js';

/**
 * 原文的一个章节单元：按二级、三级标题切开，标题下面到下一个标题之前的内容算一节。
 * 卡片的每个 h2 用 sources 声明自己讲的是哪几节，拿它对账才知道有没有整节漏掉，
 * 截图也才能判断是不是被挪去给别的章节配图
 */
export interface SourceUnit {
  id: string;
  title: string;
  /** 正文字数，决定这一节算不算核心内容 */
  chars: number;
  /** 这一节的内容块，不含标题 */
  blockIds: string[];
  imageIds: string[];
}

/** 正文不到这么多字的节多半是过渡句或广告，漏掉不算缺内容 */
const CORE_MIN_CHARS = 150;

export function sourceUnits(blocks: SourceBlock[]): SourceUnit[] {
  const units: Omit<SourceUnit, 'id'>[] = [];
  let chapter = '';
  let current: Omit<SourceUnit, 'id'> | undefined;

  const open = (title: string) => {
    current = { title, chars: 0, blockIds: [], imageIds: [] };
    units.push(current);
  };

  for (const b of blocks) {
    if (b.kind === 'h2') {
      chapter = b.text ?? '';
      open(chapter);
      continue;
    }
    if (b.kind === 'h3') {
      open(chapter ? `${chapter} / ${b.text ?? ''}` : (b.text ?? ''));
      continue;
    }
    if (!current) open('开篇');
    current!.blockIds.push(b.id);
    if (b.kind === 'image' && b.imageId) current!.imageIds.push(b.imageId);
    current!.chars += contentLength(b);
  }

  return units.filter((u) => u.blockIds.length > 0).map((u, i) => ({ ...u, id: `s${i}` }));
}

export function isCoreUnit(unit: SourceUnit): boolean {
  return unit.chars >= CORE_MIN_CHARS;
}

/** 截图 id → 它在原文里所属的节 */
export function imageUnits(units: SourceUnit[]): Map<string, string> {
  return new Map(units.flatMap((u) => u.imageIds.map((id) => [id, u.id] as const)));
}

function contentLength(b: SourceBlock): number {
  if (b.kind === 'code') return 0;
  return (b.text ?? '').length + (b.items ?? []).join('').length;
}
