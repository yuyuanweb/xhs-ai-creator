import type { ArticleIndex } from './article-index.js';
import { CARD_BLOCK_KINDS, hasContent, tidyBlock } from './blocks.js';
import { groundedCaption, isShot } from './images.js';
import type { BlockPatch } from './types/agent.js';
import type { CardBlock, CardBlockKind } from './types/deck.js';

/** 段首一行像「7、排行榜」「## 标题」，说明模型把章节标题写进了正文 */
const HEADING_LINE = /^\s*(#{1,4}\s|\d{1,2}\s*[、.．]\s*\S[^\n]{0,30}\n)/;

const isHeadingKind = (k: CardBlockKind | undefined) => k === 'h2' || k === 'h3';

/** 修版只能调内容和分页，不能改章节结构，否则会出现章节重复、截图串节 */
function structureViolation(
  blocks: CardBlock[],
  prev: CardBlock | undefined,
  next: Partial<CardBlock>,
): string | null {
  const kind = next.kind ?? prev?.kind;
  if (prev && isHeadingKind(prev.kind) && !isHeadingKind(kind)) {
    return `不能把标题 ${prev.id} 改成 ${kind}，要合并章节请改 breakHint`;
  }
  if (!prev && isHeadingKind(kind) && blocks.some((b) => isHeadingKind(b.kind) && b.text === next.text)) {
    return `标题「${next.text}」已经存在，不要重复插入`;
  }
  if ((kind === 'p' || kind === 'quote') && next.text && HEADING_LINE.test(next.text)) {
    return `段落里不能写章节标题「${next.text.split('\n')[0]}」`;
  }
  if (!isHeadingKind(kind)) {
    const head = fingerprint({ ...next, kind });
    const dup = blocks.find(
      (b) => b !== prev && b.kind === kind && ((head.length >= DUP_PREFIX && fingerprint(b) === head) || sameFacts(b, next)),
    );
    if (dup) return `和已有的块 ${dup.id} 内容重复，不要再插一遍`;
  }
  return null;
}

/**
 * 组件换个标签重插一遍是模型最常见的重复方式：数字和标题没变，只是「GPT-6 Astra」改叫「最聪明」。
 * 所以按条目里的数字和标题比，六成以上相同就算同一个组件
 */
function sameFacts(a: Partial<CardBlock>, b: Partial<CardBlock>): boolean {
  const facts = (x: Partial<CardBlock>) =>
    new Set(
      [...(x.entries ?? []).map((e) => e.value ?? e.title), ...(x.rows ?? []).flat()]
        .filter((v): v is string => Boolean(v?.trim()))
        .map((v) => v.replace(/\s|\*/g, '')),
    );
  const fa = facts(a);
  const fb = facts(b);
  const smaller = Math.min(fa.size, fb.size);
  if (smaller < 2) return false;
  const shared = [...fa].filter((v) => fb.has(v)).length;
  return shared / smaller >= 0.6;
}

/** 开头这么多字都一样就算重复。模型重复插入时往往整段照抄 */
const DUP_PREFIX = 16;

/** 块里所有能印出来的字连起来取开头。组件没有 text，要把条目和表格的字也算进来，否则重复插一张表拦不住 */
function fingerprint(b: Partial<CardBlock>): string {
  const parts = [
    b.text,
    ...(b.items ?? []),
    ...(b.entries ?? []).flatMap((e) => [e.label, e.title, e.value, e.text]),
    ...(b.rows ?? []).flat(),
  ];
  return parts.filter(Boolean).join('').replace(/\s|\*/g, '').slice(0, DUP_PREFIX);
}

type Vetted = { block: CardBlock; note?: string } | { error: string };

/**
 * 截图块的硬规则：只能用原文里够大的截图，同一张图全篇只出现一次，两张截图不能连着放，
 * 只能放进 sources 含它原文所在节的章节，图注里的具体内容原文必须有。
 * 模型看不到图，这几条不在代码里卡住，它会为了凑张数把表情包当成表格截图、给同一张图换个图注再插一遍、
 * 把没地方放的截图一张接一张堆在最后。
 *
 * others 是除它以外的块，at 是它落在 others 里的位置
 */
function vetImage(others: CardBlock[], at: number, block: CardBlock, source: ArticleIndex): Vetted {
  if (block.kind !== 'image') return { block };
  if (!isShot(source.images.get(block.imageId ?? ''))) {
    return { error: `${block.imageId} 不是可用的截图（不存在，或是表情包、图标这类小图）` };
  }
  const dup = others.find((b) => b.kind === 'image' && b.imageId === block.imageId);
  if (dup) return { error: `截图 ${block.imageId} 已经在块 ${dup.id} 用过，同一张图不能用两次` };
  if (others[at - 1]?.kind === 'image' || others[at]?.kind === 'image') {
    return { error: `截图 ${block.imageId} 不能紧挨着另一张截图，两张图之间要隔着介绍它的段落或组件` };
  }

  const unit = source.imageUnits.get(block.imageId!);
  const chapter = others
    .slice(0, at)
    .reverse()
    .find((b) => b.kind === 'h2');
  if (unit && chapter?.sources?.length && !chapter.sources.includes(unit)) {
    return {
      error: `截图 ${block.imageId} 在原文属于 ${unit}，而 ${chapter.id} 这一章讲的是 ${chapter.sources.join('、')}，不能拿来给别的章节配图`,
    };
  }

  if (block.text?.trim() && !groundedCaption(block.text, source.markdown)) {
    return {
      block: { ...block, text: '' },
      note: `${block.id} 的图注超过 40 字或写了原文里没有的名称、数字，已清空。图注只能复述原文前后文，不要描述你看不到的画面细节`,
    };
  }
  return { block };
}

/** 新块的 id 要避开现有 id，否则替换和删除会误伤 */
function makeIdFactory(existing: CardBlock[]) {
  const used = new Set(existing.map((b) => b.id));
  let n = 0;
  return () => {
    let id: string;
    do {
      id = `n${(n++).toString(36)}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
}

export interface PatchResult {
  blocks: CardBlock[];
  applied: number;
  /** 引用了不存在的块之类的问题要回报给模型，不然它会以为改动生效了 */
  skipped: string[];
}

export function applyPatches(blocks: CardBlock[], patches: BlockPatch[], source: ArticleIndex): PatchResult {
  const nextId = makeIdFactory(blocks);
  let out = [...blocks];
  let applied = 0;
  const skipped: string[] = [];

  /** 截图不合规就拒掉；图注编造只清图注，块照样生效 */
  const vetted = (block: CardBlock, others: CardBlock[], at: number): CardBlock | null => {
    const res = vetImage(others, at, block, source);
    if ('error' in res) {
      skipped.push(res.error);
      return null;
    }
    if (res.note) skipped.push(res.note);
    return res.block;
  };

  for (const p of patches) {
    const index = out.findIndex((b) => b.id === p.blockId);

    switch (p.op) {
      case 'replace': {
        if (index === -1) {
          skipped.push(`replace 引用了不存在的块 ${p.blockId}`);
          break;
        }
        const prev = out[index]!;
        const violation = structureViolation(out, prev, p.block ?? {});
        if (violation) {
          skipped.push(violation);
          break;
        }
        const others = out.filter((_, i) => i !== index);
        const next = vetted({ ...prev, ...sanitize(p.block), id: prev.id }, others, index);
        if (!next) break;
        out[index] = next;
        applied++;
        break;
      }

      case 'remove': {
        if (index === -1) {
          skipped.push(`remove 引用了不存在的块 ${p.blockId}`);
          break;
        }
        if (out[index]!.kind === 'h2') {
          skipped.push(`不能删掉章节标题 ${p.blockId}，原文每一节都要有卡片讲到；这一页太空就 setBreak join 并进上一页`);
          break;
        }
        out.splice(index, 1);
        applied++;
        break;
      }

      case 'insert': {
        const kind = p.block?.kind;
        if (!kind || !CARD_BLOCK_KINDS.includes(kind)) {
          skipped.push(`insert 缺少合法的 kind`);
          break;
        }
        if (!hasContent(sanitize(p.block))) {
          skipped.push(`insert 的 ${kind} 块没有内容，组件块要带 entries 或 rows`);
          break;
        }
        if (p.blockId && index === -1) {
          skipped.push(`insert 的锚点块 ${p.blockId} 不存在`);
          break;
        }
        const violation = structureViolation(out, undefined, p.block ?? {});
        if (violation) {
          skipped.push(violation);
          break;
        }
        const block = vetted({ kind, ...sanitize(p.block), id: nextId() }, out, index + 1);
        if (!block) break;
        out.splice(index + 1, 0, block);
        applied++;
        break;
      }

      case 'setBreak': {
        if (index === -1) {
          skipped.push(`setBreak 引用了不存在的块 ${p.blockId}`);
          break;
        }
        const { breakHint: _drop, ...rest } = out[index]!;
        if (p.hint === 'break' && rest.kind === 'image') {
          skipped.push(`截图 ${p.blockId} 不能和它的说明文字分页，要换页请把 break 加在说明段上`);
          break;
        }
        out[index] = p.hint ? { ...rest, breakHint: p.hint } : rest;
        applied++;
        break;
      }

      default:
        skipped.push(`未知操作 ${String((p as BlockPatch).op)}`);
    }
  }

  return { blocks: out, applied, skipped };
}

function sanitize(block: Partial<CardBlock> | undefined): Partial<CardBlock> {
  return block ? tidyBlock(block) : {};
}
