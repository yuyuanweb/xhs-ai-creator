import { BadRequestException } from '@nestjs/common';
import {
  TARGET_CARDS,
  THEMES,
  defaultCover,
  findAccent,
  findTheme,
  isMetaLabel,
  normalizeOverlays,
  normalizeQuotes,
  unfoldNewlines,
  type ContentType,
  type CoverSpec,
  type DraftProposal,
  type SourceArticle,
  type SourceUnit,
} from '@rcs/shared';
import type { DraftBlocks, RawBlock } from './draft-blocks';

/**
 * 初稿的输出格式和收稿规则。编辑器里的 AI 和 Cursor 这类外部 Agent 写的是同一份 JSON，
 * 走同一套清洗，落库后的稿子长得一样
 */

export const CONTENT_TYPES: ContentType[] = ['opinion', 'listicle', 'review', 'tutorial'];

export interface RawDraft {
  contentType: ContentType;
  targetCards?: number;
  rationale?: string;
  themeId?: string;
  accentId?: string;
  topic?: string;
  series?: string;
  cover?: Partial<CoverSpec>;
  blocks?: RawBlock[];
  overlays?: unknown;
}

/** 模型给的块不带 id，由服务端统一分配；块的清洗规则见 DraftBlocks */
export function normalizeDraft(raw: RawDraft, article: SourceArticle, drafter: DraftBlocks): DraftProposal {
  const contentType = CONTENT_TYPES.includes(raw.contentType) ? raw.contentType : 'opinion';
  const limits = TARGET_CARDS[contentType];

  const blocks = drafter.normalize(raw.blocks);
  if (!blocks.length) throw new BadRequestException('模型没有产出任何卡片内容，请重试或换个模型');

  const theme = findTheme(raw.themeId ?? '');
  return {
    contentType,
    targetCards: clamp(raw.targetCards ?? limits.default, limits.min, limits.max),
    rationale: raw.rationale ?? '',
    blocks,
    overlays: normalizeOverlays(raw.overlays, blocks),
    cover: normalizeCover(raw.cover, article.title),
    themeId: theme.id,
    accentId: findAccent(theme, raw.accentId).id,
    ...(raw.topic?.trim() && { topic: raw.topic.trim() }),
    ...(raw.series?.trim() && { series: raw.series.trim() }),
  };
}

/** 漏掉的核心节和补写要求。只要这几节的块，整份重写既慢又会把前半部分写好的改坏 */
export function gapBrief(missing: SourceUnit[]): string {
  const list = missing.map((u) => `- ${u.id} ${u.title}（约 ${u.chars} 字${u.imageIds.length ? `，${u.imageIds.length} 张图` : ''}）`);
  return [
    '这份初稿漏掉了原文下面这些核心章节，读者看完会以为文章只讲了前半部分：',
    ...list,
    '',
    '只为这些章节补写卡片，写法和初稿前半部分完全一样：一页一个 h2，组件页和截图页穿插，每页写满，每个 h2 都要写 sources。',
    '每一节的关键结论、做法、数字都要写进去；内容少的相邻节合成一个 h2，内容多的节拆成两个 h2。',
    '截图只用这几节里的，而且不能和初稿已经用过的重复，两张截图之间必须隔着文字或组件。不要重复初稿已有的页。',
  ].join('\n');
}

/** 封面各件都是短文本，模型偶尔给出数字或空串，这里统一收成字符串并丢掉空的 */
function normalizeCover(raw: Partial<CoverSpec> | undefined, fallbackTitle: string): CoverSpec {
  const base = defaultCover(fallbackTitle);
  if (!raw) return base;

  const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? normalizeQuotes(String(v).trim()) : '');
  const lines = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const node = (n: unknown) => {
    const o = (n ?? {}) as { title?: unknown; lines?: unknown };
    return { title: str(o.title), lines: lines(o.lines).slice(0, 3) };
  };
  const flow = raw.flow ? { from: node(raw.flow.from), to: node(raw.flow.to) } : undefined;
  const facts = (raw.facts ?? []).map((f) => ({ label: str(f?.label), text: str(f?.text) })).filter((f) => f.label && f.text);
  const stats = (raw.stats ?? []).map((s) => ({ value: str(s?.value), label: str(s?.label) })).filter((s) => s.value);
  const kicker = str(raw.kicker);

  return {
    title: unfoldNewlines(str(raw.title) || base.title),
    variant: raw.variant ?? base.variant,
    ...(kicker && !isMetaLabel(kicker) && { kicker }),
    ...(str(raw.lead) && { lead: unfoldNewlines(str(raw.lead)) }),
    chips: lines(raw.chips).slice(0, 3),
    points: lines(raw.points).slice(0, 6),
    ...(flow?.from.title && flow.to.title ? { flow } : {}),
    ...(facts.length ? { facts: facts.slice(0, 4) } : {}),
    ...(stats.length ? { stats: stats.slice(0, 4) } : {}),
    ...(str(raw.note) && { note: str(raw.note) }),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export const DRAFT_OUTPUT_SPEC = `只输出 JSON，不要有任何解释文字。结构如下：

{
  "contentType": "opinion | listicle | review | tutorial",
  "targetCards": 目标卡片总数（含封面）,
  "rationale": "为什么判成这个类型、为什么定这个张数，一两句话",
  "themeId": ${JSON.stringify(THEMES.map((t) => t.id).join(' | '))},
  "accentId": "所选主题下的强调色 id",
  "topic": "这篇的话题，印在每页页眉右上，8 到 14 字，如「个人小程序 · 虚拟支付」",
  "series": "整篇文章的主题，印在每页页脚左下，10 到 16 字。以原文标题和全文内容为准，一句话说清这组卡片从头到尾讲了什么，不能只概括开头那一节，如「个人小程序从开通支付到代码落地」",
  "cover": {
    "variant": ${JSON.stringify(THEMES.map((t) => `${t.id} 主题用 ${t.coverVariants[0]}`).join('，'))},
    "kicker": "标题上方的一句引子：poster / checklist 封面写一句口语化的起因，如「做了个小工具，终于能卖会员了。」；digest 封面写 6 到 12 字点出主角最反常识之处的引题。不写「开篇定调」这类版面标注",
    "title": "封面标题，2 到 3 行、每行 5 到 8 字，可以是问句。用 \\\\n 断行，不要用 ** 包",
    "flow": { "from": { "title": "poster 封面的流程框起点，4 到 6 字", "lines": ["两行小字说明，每行 8 字以内"] }, "to": { "title": "终点，4 到 6 字", "lines": ["两行小字说明"] } },
    "points": ["poster 封面底部两栏要点、checklist 封面便签上的勾选清单，4 或 6 条，每条 10 字以内"],
    "lead": "digest / checklist 封面的两句导语，40 字以内",
    "facts": [{ "label": "digest 封面的三行：是什么 / 怎么做到 / 有什么用", "text": "一句话，25 字以内" }],
    "stats": [{ "value": "digest 封面的原文关键数字，3 个，如「0」「255」「70–500ms」", "label": "这个数字是什么，10 字以内" }],
    "note": "digest 封面的一句全篇概述，如「从它是什么，到怎么接入」。不要写张数，渲染时会自动补上「全 N 图」"
  },
  "blocks": [
    { "kind": "h2 | h3 | p | ul | ol | image | code | quote | steps | stats | cards | callout | table | flow | chart",
      "text": "h2 / h3 / p / quote / callout 的文字，支持 **加粗**；h2 可以用 \\\\n 断成两行；image 块填图注，15 到 30 字，只复述原文前后文、不写画面细节，前后文没讲这张图是什么的留空字符串",
      "label": "callout 的小标签（如「一个容易被忽略的细节」）；chart 的图题（如「首字延迟，越短越好」）。h2 不写 label",
      "items": ["ul / ol 的条目"],
      "entries": [{ "label": "小标签", "title": "标题", "value": "数字", "text": "一两句说明" }],
      "rows": [["表头 1", "表头 2"], ["单元格", "单元格"]],
      "tone": "callout 的语气：accent 结论 | dark 压轴金句 | warn 风险和边界",
      "marker": "steps 的行首：number 序号 | arrow 箭头",
      "highlight": "cards / flow / chart 里要高亮的那一项的下标，从 0 开始，不需要就省略",
      "imageId": "image 块引用的配图 id，必须来自可用配图列表，同一个 id 全篇只能用一次",
      "code": "code 块的代码", "lang": "语言",
      "section": "所属章节的中文短名，2 到 6 个字，印在卡片页眉，如「上手」「实测」；不要英文 key",
      "sources": ["只给 h2 写：这一页讲的是原文章节清单里的哪几节，如 [\\"s3\\"] 或 [\\"s5\\", \\"s6\\"]"],
      "breakHint": "break 另起一页 / join 必须和上一块同页，不需要时省略" }
  ],
  "overlays": [
    { "at": "cover 或原文章节号如 s2", "kind": "emoji | icon", "emoji": "素材库里的表情", "icon": "素材库里的图标 id", "x": 88, "y": 10, "size": 10, "rotate": 0 }
  ]
}

封面的 flow / points 和 lead / facts / stats / note 都要写：用户随时会切换主题和封面，只写一部分的话，换过去的那张封面下半页是空的。

组件块各自用哪些字段：
- steps 序号行：entries 里每项写 title（10 字以内的要点）和 text（一两句说明，30 字以内），3 到 5 项
- stats 大数字：entries 里每项写 value（数字本身，如「1%」「12%」「3–329 秒」）、label（这个数属于谁，如「安卓 / 鸿蒙」）、text（一句说明），2 到 3 项
- cards 卡片组：entries 里每项写 label（可选的小标签，如「Choice」「01 / 项目上下文」）、title（6 到 12 字）、text（一两句说明），2 到 6 项；两张就是左右对照，要突出哪一张用 highlight
- callout 提示框：text 写一到两句，label 可选；dark 语气的 text 里用 ** 包住最要紧的几个字
- table 表格：rows 第一行是表头，2 到 3 列、3 到 6 行，每格 12 字以内
- flow 流程图：entries 里每项是一个环节，写 title（4 到 8 字）和 text（一句，20 字以内），3 到 5 项，按先后顺序排；最终产出那一环用 highlight 标出
- chart 条形图：entries 里每项写 label（对象，如「Jev」「DeepSeek」）和 value（带单位的单个数字，如「120ms」，同一张图单位一致，不能写区间），2 到 6 项；块的 label 写图题并注明越大越好还是越小越好。value 画不成条的整块会退成大数字

块不要写 id，服务端会统一分配。image 块的 imageId 只能用可用配图列表里出现过的，引用别的会被丢弃；截图只能放在 sources 含它原文所在节的那一章里，两张截图不能连着放，否则也会被丢弃。

原文章节清单里标「核心」的每一节，都必须出现在某个 h2 的 sources 里。写完先对一遍清单，漏掉的节补上再输出。

overlays 是浮在页面角落的装饰，不占正文版面、不参与测高。整组卡片用 3 到 6 个，封面至少 1 个。at 写 cover 或这一页 h2 认领的原文章节号（如 s2）。从下面的素材库里选，不要自己发明图标 id。组件标题和标签里的 emoji 按写作风格里的规则配，正文句子中间不要插表情。
素材库表情：💡 🔥 ✅ ⚠️ ⭐ 📌 🎯 🚀 ✨ 🤔 👏 ⬇️ ➡️ 💰 📊 🛠️ 🔒 🔑 ⏱️ 🆕
素材库图标 id：star / check / bolt / arrow / warn / dot / quote / plus。icon 只和 kind=icon 一起用。`;
