import { CARD_BLOCK_KINDS, COVER_VARIANTS } from '@rcs/shared';

/**
 * Agent 可调用的工具。全部在浏览器里执行——
 * 测高依赖真实 DOM，后端没有渲染环境也不需要有。
 */
export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'measure_layout',
      description:
        '测量当前卡片稿的真实排版结果，返回总张数、每页填充率、溢出页、过空页。这是唯一的客观反馈来源，改完内容后必须调用它确认效果。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'revise_blocks',
      description: '增量修改卡片内容。只改有问题的块，不要重写已经合格的部分。一次最多 4 个补丁，要改的多就分几次调用，写太长会被截断而整次失效。',
      parameters: {
        type: 'object',
        properties: {
          patches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: {
                  type: 'string',
                  enum: ['replace', 'remove', 'insert', 'setBreak'],
                  description:
                    'replace 覆盖指定块；remove 删除指定块；insert 在指定块之后插入新块；setBreak 只调整分页意图',
                },
                blockId: {
                  type: 'string',
                  description: 'insert 时表示插入位置的锚点块，留空则插到最前面',
                },
                block: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: CARD_BLOCK_KINDS },
                    text: {
                      type: 'string',
                      description:
                        '正文内容；kind 为 image 时这里是印在截图下方的图注，15 到 30 字，只能复述原文前后文，不能写原文没有的按钮名、数字等画面细节。原文没讲这张图是什么就留空，不要猜',
                    },
                    label: {
                      type: 'string',
                      description: 'callout 的小标签，或 chart 的图题。h2 不写 label',
                    },
                    items: { type: 'array', items: { type: 'string' }, description: '只给 ul / ol 用，组件块的条目放 entries' },
                    entries: {
                      type: 'array',
                      description:
                        '组件条目。steps / flow 用 title + text；stats 用 label + value + text；cards 用 label + title + text；chart 用 label + value，value 是带单位的单个数字，不能写区间',
                      items: {
                        type: 'object',
                        properties: {
                          label: { type: 'string' },
                          title: { type: 'string' },
                          value: { type: 'string' },
                          text: { type: 'string' },
                        },
                      },
                    },
                    rows: {
                      type: 'array',
                      description: 'table 的行，第一行是表头',
                      items: { type: 'array', items: { type: 'string' } },
                    },
                    tone: { type: 'string', enum: ['accent', 'dark', 'warn'] },
                    marker: { type: 'string', enum: ['number', 'arrow'] },
                    highlight: { type: 'number', description: 'cards / flow / chart 里高亮的那一项，从 0 开始' },
                    imageId: { type: 'string', description: '只能用 unusedImages 里的截图，同一张图全篇只能用一次' },
                    code: { type: 'string' },
                    lang: { type: 'string' },
                    section: { type: 'string', description: '章节中文短名，2 到 6 字，印在卡片页眉' },
                    sources: {
                      type: 'array',
                      items: { type: 'string' },
                      description: '只给 h2 用：这一页讲的是原文章节清单里的哪几节，如 ["s3"]。replace 已有的 h2 时省略，保持原样',
                    },
                  },
                },
                hint: {
                  type: ['string', 'null'],
                  enum: ['break', 'join', null],
                  description: 'break 另起一页；join 必须和上一块同页；null 清除意图',
                },
              },
              required: ['op', 'blockId'],
            },
          },
          reason: { type: 'string', description: '这次改动解决的是哪个体检问题' },
        },
        required: ['patches', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'revise_cover',
      description: '修改封面文案。标题用 \\n 手动断行。只传要改的字段。',
      parameters: {
        type: 'object',
        properties: {
          cover: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              kicker: { type: 'string' },
              lead: { type: 'string' },
              chips: { type: 'array', items: { type: 'string' } },
              points: { type: 'array', items: { type: 'string' } },
              note: { type: 'string' },
              variant: { type: 'string', enum: COVER_VARIANTS },
            },
          },
          reason: { type: 'string' },
        },
        required: ['cover', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_settings',
      description:
        '调整排版参数。注意全篇字号必须统一，不要试图靠缩字号把内容塞进页面，那会让连续翻页时显得业余。',
      parameters: {
        type: 'object',
        properties: {
          fontSize: { type: 'number', description: '正文字号，30 到 46 之间' },
          imageScale: { type: 'number', description: '配图宽度百分比，60 到 100' },
          targetCards: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'finish',
      description: '指标达标或确实改不动时调用，结束本次迭代。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '这一稿做了什么、还有什么已知问题' },
        },
        required: ['summary'],
      },
    },
  },
];
