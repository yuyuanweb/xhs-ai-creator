import { readFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { BlockPatch, Deck, DraftImportResult } from '@rcs/shared';
import { StudioApi } from './api.js';
import { loadConfig } from './config.js';
import { checkLayout, describeRevise } from './layout.js';

/**
 * 小红书图文工作台的 MCP 入口。卡片稿由 Cursor 里正在对话的模型亲自写，
 * 工作台只提供规则、原文，收稿后做和内置 AI 同一套的清洗、截图校验、章节对账和落库。
 * stdout 是 MCP 协议通道，任何日志都只能写 stderr
 */

const INSTRUCTIONS = `小红书图文工作台：把一篇长图文改写成一组小红书图片卡片。卡片稿由你亲自写，工作台负责排版、校验和保存。
流程：
1. 文章还没导入就用 import_article（传本地 Markdown 文件路径）；已经导入过的用 list_articles 找到它。
2. 用 get_draft_brief 拿到写作规则、原文和初稿 JSON 格式，严格按规则写出整份初稿。
3. 用 submit_draft 交稿。返回里列出漏掉的核心章节时，用 supplement_chapters 只补写这些章节，直到没有漏节。
4. 章节补齐后，submit_draft / supplement_chapters 的返回会附上编辑台实测的排版：每页填充率、哪几页装不下、哪几页过空、这一轮要做什么。写稿时估的版面不准，以它为准。
5. 有装不下或过空的页，或者「这一轮要做」里点名了文案问题，就用 revise_blocks 按块 id 只改那几处，它的返回同样附上改完的实测排版。一直改到排版和文案全部达标，或者连续两轮都改不动才停。没达标不算完成，不要为了修几页整份重交 submit_draft。
6. 把 editorUrl 交给用户，他在编辑台里精修和导出。
测高只能在浏览器里做：返回里提示编辑台没打开或在后台时，请用户打开 editorUrl 并留在前台，然后调用 get_layout 继续检查。
要整体重写一份已有的稿子：用 get_deck 读出当前稿（格式和初稿 JSON 相同），改好后整份用 submit_draft 交回。`;

const MIN_MARKDOWN = 50;

const api = new StudioApi(loadConfig());
const server = new McpServer({ name: 'rednote-studio', version: '0.1.0' }, { instructions: INSTRUCTIONS });

server.registerTool(
  'list_articles',
  { description: '列出工作台里已导入的文章，最近改过的在前', inputSchema: {} },
  run(async () => {
    const list = await api.listArticles();
    if (!list.length) return '工作台里还没有文章，用 import_article 导入一篇';
    return list.map((a) => `${a.id}｜${a.title}｜${a.updatedAt.slice(0, 16).replace('T', ' ')}`).join('\n');
  }),
);

server.registerTool(
  'import_article',
  {
    description: '把一篇 Markdown 长图文导入工作台，服务端会转存配图，并建好一份空卡片稿。path 和 markdown 二选一',
    inputSchema: {
      path: z.string().optional().describe('本地 Markdown 文件路径，相对路径按当前工作目录解析'),
      markdown: z.string().optional().describe('Markdown 正文，没有文件时直接传'),
      title: z.string().optional().describe('文章标题，不传时取文件名或正文里的一级标题'),
    },
  },
  run(async ({ path, markdown, title }) => {
    const source = path ? await readMarkdown(path) : markdown;
    if (!source || source.trim().length < MIN_MARKDOWN) throw new Error('正文太短，看起来不是一篇长图文');

    const article = await api.createArticle(source, title ?? (path ? titleFromFile(path) : undefined));
    const deck = await api.createDeck(article.id);
    const failed = article.images.filter((i) => !i.url).length;
    return [
      `已导入「${article.title}」`,
      `articleId: ${article.id}`,
      `deckId: ${deck.id}`,
      `配图 ${article.images.length} 张${failed ? `，其中 ${failed} 张抓取失败，用不上` : ''}`,
      '下一步：get_draft_brief',
    ].join('\n');
  }),
);

server.registerTool(
  'get_draft_brief',
  {
    description: '拿到写卡片初稿需要的全部材料：写作规则、带章节号和配图 id 的原文、初稿 JSON 格式。传 deckId，或传 articleId 自动取这篇最近的卡片稿',
    inputSchema: {
      deckId: z.string().optional(),
      articleId: z.string().optional(),
    },
  },
  run(async ({ deckId, articleId }) => {
    const id = await resolveDeck(deckId, articleId);
    const brief = await api.brief(id);
    return [
      `deckId: ${brief.deckId}（交稿时用）`,
      `文章：${brief.title}`,
      '',
      '# 写作规则',
      brief.rules,
      '',
      '# 原文',
      brief.article,
      '',
      '# 初稿 JSON 格式',
      brief.outputSpec,
      '',
      '写完后调用 submit_draft，draft 参数就是按上面格式写出的 JSON 对象，不要包成字符串。',
    ].join('\n');
  }),
);

server.registerTool(
  'submit_draft',
  {
    description: '提交整份卡片初稿，覆盖这份卡片稿原有的内容。服务端会清洗块、丢掉不合规的截图，并对账有没有漏掉原文的核心章节',
    inputSchema: {
      deckId: z.string(),
      draft: z.record(z.string(), z.unknown()).describe('按 get_draft_brief 给出的格式写的初稿 JSON 对象'),
    },
  },
  run(async ({ deckId, draft }) => describeResult(await api.importDraft(deckId, draft))),
);

server.registerTool(
  'supplement_chapters',
  {
    description: '只为漏掉的核心章节补写卡片块，按原文顺序插回已有的稿子，不改动已经写好的页',
    inputSchema: {
      deckId: z.string(),
      blocks: z.array(z.record(z.string(), z.unknown())).describe('和初稿 blocks 结构相同的块，每个 h2 都要写 sources'),
    },
  },
  run(async ({ deckId, blocks }) => describeResult(await api.supplement(deckId, blocks))),
);

server.registerTool(
  'get_deck',
  {
    description: '读出一份卡片稿的当前内容，格式和初稿 JSON 相同，改好后可以整份用 submit_draft 交回。编辑台里关掉的块不会出现在这里',
    inputSchema: { deckId: z.string() },
  },
  run(async ({ deckId }) => JSON.stringify(toDraft(await api.getDeck(deckId)), null, 2)),
);

server.registerTool(
  'get_layout',
  {
    description:
      '读编辑台实测的真实排版：总张数、每页填充率、装不下和过空的页、每页的块 id 和摘要，有问题时附上这一轮要改什么、问题页的完整块和修版规则。交稿或改稿后编辑台会自动重新测量，这里会等它量完再返回',
    inputSchema: { deckId: z.string() },
  },
  run(async ({ deckId }) => checkLayout(api, deckId)),
);

server.registerTool(
  'revise_blocks',
  {
    description:
      '按块 id 增量修改卡片稿，只动指定的块，其余页原样保留。块 id 从 get_layout 里取。校验规则和编辑台内置 AI 修版相同：不能删章节标题、不能把截图挪出它所属的章节、不能重复插入已有内容',
    inputSchema: {
      deckId: z.string(),
      patches: z
        .array(
          z.object({
            op: z
              .enum(['replace', 'remove', 'insert', 'setBreak'])
              .describe('replace 用 block 里的字段覆盖指定块；remove 删除指定块；insert 在指定块之后插入 block；setBreak 只改分页意图'),
            blockId: z.string().describe('要改的块 id；insert 时是锚点，新块插在它后面，留空字符串表示插到最前面'),
            block: z
              .record(z.string(), z.unknown())
              .optional()
              .describe('replace / insert 用，字段和初稿 blocks 里的块相同；replace 只需写要改的字段，组件的 entries、rows 要整组给出'),
            hint: z.enum(['break', 'join']).nullable().optional().describe('setBreak 用：break 另起一页，join 并进上一页，null 清除'),
          }),
        )
        .min(1),
    },
  },
  run(async ({ deckId, patches }) => {
    const result = await api.revise(deckId, patches as BlockPatch[]);
    const summary = describeRevise(result);
    return result.applied ? `${summary}\n\n${await checkLayout(api, deckId)}` : summary;
  }),
);

await server.connect(new StdioServerTransport());

/** 工具出错时把原因原样交给模型，它才知道是该改稿子还是该让用户去启动服务 */
function run<A>(handler: (args: A) => Promise<string>) {
  return async (args: A) => {
    try {
      return { content: [{ type: 'text' as const, text: await handler(args) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: (err as Error).message }] };
    }
  };
}

async function resolveDeck(deckId?: string, articleId?: string): Promise<string> {
  if (deckId) return deckId;
  if (!articleId) throw new Error('deckId 和 articleId 至少传一个');
  const [latest] = await api.listDecks(articleId);
  return (latest ?? (await api.createDeck(articleId))).id;
}

async function readMarkdown(path: string): Promise<string> {
  const full = isAbsolute(path) ? path : resolve(process.cwd(), path);
  return (await readFile(full, 'utf8')).replace(/^\uFEFF/, '');
}

function titleFromFile(path: string): string | undefined {
  return basename(path, extname(path)).trim() || undefined;
}

/** 漏节时先补章节，补齐之前量排版没有意义；补齐了就等编辑台量完，把体检结果一起交回 */
async function describeResult(r: DraftImportResult): Promise<string> {
  const lines = [
    `已保存：${r.chapterCount} 章、${r.blockCount} 块、${r.imageCount} 张截图（${r.contentType} / ${r.themeId}）`,
    `编辑台：${r.editorUrl}（已经开着的会自动重新加载）`,
  ];
  if (r.gapBrief) {
    lines.push('', r.gapBrief, '', `用 supplement_chapters 提交这几节的 blocks，deckId 是 ${r.deckId}。`);
  } else {
    lines.push('原文的核心章节都已覆盖。', '', await checkLayout(api, r.deckId));
  }
  return lines.join('\n');
}

/** 已落库的稿子还原成初稿 JSON 的样子：去掉块 id 和关掉的块，设置里只留模型该管的几项 */
function toDraft(deck: Deck) {
  const off = new Set(deck.disabledBlockIds);
  const { themeId, accentId, topic, series, targetCards } = deck.settings;
  return {
    contentType: deck.contentType,
    targetCards,
    themeId,
    accentId,
    topic,
    series,
    cover: deck.cover,
    blocks: deck.blocks.filter((b) => !off.has(b.id)).map(({ id: _id, ...rest }) => rest),
    overlays: deck.overlays,
  };
}
