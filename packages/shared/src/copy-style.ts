import type { CardBlock } from './types/deck.js';

const CJK = /[\u4e00-\u9fff]/;

/**
 * 卡片上的引号统一成中文双引号。规则里用「」标注例子，模型常把它原样带进正文；
 * 英文直引号只在夹着中文时才换，免得误伤代码、命令里的引号
 */
export function normalizeQuotes(text: string): string {
  const out = text.replace(/「/g, '“').replace(/」/g, '”').replace(/『/g, '‘').replace(/』/g, '’');
  return CJK.test(out) ? out.replace(/"([^"\n]*)"/g, '“$1”') : out;
}

interface CopyRule {
  pattern: RegExp;
  advice: (hit: string) => string;
}

const BANNED_WORDS = [
  '赋能', '抓手', '闭环', '底层逻辑', '复盘', '心智', '势能', '组合拳',
  '干货满满', '史上最全', '震惊', '彻底搞懂', '保姆级',
  '极致', '完美', '革命性', '颠覆',
  '笔者', '各位', '同学们', '小伙伴们',
];

/** 一眼就能看出是 AI 写的用词和标点，代码能确定地查出来，不用指望模型自觉 */
const COPY_RULES: CopyRule[] = [
  { pattern: /(?<!参)与/g, advice: () => '“与”换成“和”' },
  { pattern: /—+/g, advice: () => '去掉破折号，改用逗号或者重新组织句子' },
  { pattern: new RegExp(BANNED_WORDS.join('|'), 'g'), advice: (w) => `“${w}”是禁用词，换成平实的说法` },
];

export interface CopyIssue {
  blockId: string;
  problems: string[];
}

/** 块里所有印在卡片上的字。code 块原样展示，不查 */
function printedText(b: CardBlock): string {
  if (b.kind === 'code') return '';
  return [
    b.text,
    b.label,
    ...(b.items ?? []),
    ...(b.entries ?? []).flatMap((e) => [e.label, e.title, e.value, e.text]),
    ...(b.rows ?? []).flat(),
  ]
    .filter(Boolean)
    .join('\n');
}

export function copyIssues(blocks: CardBlock[]): CopyIssue[] {
  return blocks.flatMap((b) => {
    const text = printedText(b);
    const problems = new Set<string>();
    for (const rule of COPY_RULES) {
      for (const [hit] of text.matchAll(rule.pattern)) problems.add(rule.advice(hit));
    }
    return problems.size ? [{ blockId: b.id, problems: [...problems] }] : [];
  });
}

export function describeCopyIssues(issues: CopyIssue[]): string {
  const list = issues.map((i) => `${i.blockId}：${i.problems.join('；')}`).join('，');
  return `这些块的文案有明显的 AI 腔，用 revise_blocks 按块 id 只改这几处词句，不要借机重写整块：${list}`;
}
