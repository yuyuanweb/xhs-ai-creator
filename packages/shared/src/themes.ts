import type { Theme, ThemeAccent, ThemeMode } from './types/theme.js';

const SANS = `Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif`;
const SERIF = `'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', Georgia, serif`;
const MONO = `'SF Mono', 'IBM Plex Mono', Menlo, Monaco, Consolas, monospace`;

/**
 * 每套主题各管一种气质：瑞士靠细线、网格和一记高饱和色块，论文靠纸感、衬线和蓝橙两色分工，
 * 手帐靠方格纸和便签，暗夜靠深底和霓虹色，波普靠粗描边和硬投影。
 * 强调色只换颜色不换版式，翻页手感保持一致。
 */
export const THEMES: Theme[] = [
  {
    id: 'memo',
    name: '手帐',
    mode: 'memo',
    description: '方格纸底、圆角白便签、胶带标签和马克笔高亮，亲切得像一页学习笔记。经验分享、清单合集、新手入门优先选它',
    coverVariants: ['checklist', 'poster', 'headline'],
    tokens: {
      bg: '#fbf8f1',
      surface: '#ffffff',
      text: '#3a3631',
      heading: '#24211d',
      muted: '#8c8478',
      warn: '#e8590c',
      divider: '#e8e1d4',
      codeBg: '#2b2722',
      codeText: '#f3eee5',
      imageRadius: '16px',
      imageBorder: '8px solid #ffffff',
      bodyFont: SANS,
      headingFont: SANS,
      codeFont: MONO,
      headingWeight: '700',
      displayWeight: '800',
      displayTracking: '0.01em',
    },
    accents: [
      { id: 'honey', name: '蜂蜜黄', accent: '#ffc93c', onAccent: '#2b2310', accentInk: '#a86f00', marker: 'rgba(255, 201, 60, 0.6)' },
      { id: 'mint', name: '薄荷绿', accent: '#4fd1a5', onAccent: '#0d2a20', accentInk: '#138a63', marker: 'rgba(79, 209, 165, 0.42)' },
      { id: 'peach', name: '蜜桃粉', accent: '#ff8a9e', onAccent: '#3d0f1a', accentInk: '#d93d5c', marker: 'rgba(255, 138, 158, 0.42)' },
      { id: 'sky', name: '天空蓝', accent: '#5aa9ff', onAccent: '#0a2240', accentInk: '#2a72c8', marker: 'rgba(90, 169, 255, 0.38)' },
    ],
  },
  {
    id: 'neon',
    name: '暗夜',
    mode: 'neon',
    description: '深色底、霓虹强调色、终端窗口式栏头和等宽小字，极客感强，在一片浅色笔记里最跳。AI 工具、模型评测、开发者向的技术内容优先选它',
    coverVariants: ['poster', 'checklist', 'headline'],
    tokens: {
      bg: '#0c1016',
      surface: '#151b24',
      text: '#c4ccd6',
      heading: '#f2f5f8',
      muted: '#7a8594',
      warn: '#ff6b6b',
      divider: '#243041',
      codeBg: '#06090d',
      codeText: '#d7e1ea',
      imageRadius: '12px',
      imageBorder: '1px solid #2a3647',
      bodyFont: SANS,
      headingFont: SANS,
      codeFont: MONO,
      headingWeight: '700',
      displayWeight: '800',
      displayTracking: '0.01em',
    },
    accents: [
      { id: 'matrix', name: '终端绿', accent: '#3dffa0', onAccent: '#04140b', marker: 'rgba(61, 255, 160, 0.24)' },
      { id: 'cyan', name: '电光青', accent: '#2ee6ff', onAccent: '#031419', marker: 'rgba(46, 230, 255, 0.24)' },
      { id: 'violet', name: '霓虹紫', accent: '#b18cff', onAccent: '#140a2e', marker: 'rgba(177, 140, 255, 0.28)' },
      { id: 'pink', name: '赛博粉', accent: '#ff5fa8', onAccent: '#24040f', marker: 'rgba(255, 95, 168, 0.26)' },
    ],
  },
  {
    id: 'pop',
    name: '波普',
    mode: 'pop',
    description: '奶油底、粗黑描边、硬投影和撞色块，冲击力强、缩略图里一眼就能认出来。观点干货、反常识结论、对比测评优先选它',
    coverVariants: ['poster', 'checklist', 'headline'],
    tokens: {
      bg: '#fff3df',
      surface: '#ffffff',
      text: '#1f1d1a',
      heading: '#111111',
      muted: '#6f6657',
      warn: '#ff4d4f',
      divider: '#ead9bd',
      codeBg: '#111111',
      codeText: '#fff3df',
      imageRadius: '16px',
      imageBorder: '3px solid #111111',
      bodyFont: SANS,
      headingFont: SANS,
      codeFont: MONO,
      headingWeight: '800',
      displayWeight: '900',
      displayTracking: '0',
    },
    accents: [
      { id: 'tomato', name: '番茄红', accent: '#ff6b4a', onAccent: '#111111', accentInk: '#e0451f', marker: 'rgba(255, 107, 74, 0.38)' },
      { id: 'lemon', name: '柠檬黄', accent: '#ffd43b', onAccent: '#111111', accentInk: '#9c7400', marker: 'rgba(255, 212, 59, 0.7)' },
      { id: 'violet', name: '电光紫', accent: '#8c6cff', onAccent: '#ffffff', accentInk: '#6a4bff', marker: 'rgba(140, 108, 255, 0.32)' },
      { id: 'soda', name: '汽水绿', accent: '#2fd38f', onAccent: '#111111', accentInk: '#11905c', marker: 'rgba(47, 211, 143, 0.42)' },
    ],
  },
  {
    id: 'swiss',
    name: '瑞士',
    mode: 'swiss',
    description: '米白底、黑细线、细字重大标题，靠满版色块和序号行撑结构。实战教程、接入流程、踩坑清单优先选它',
    coverVariants: ['poster', 'checklist', 'headline'],
    tokens: {
      bg: '#f7f7f3',
      surface: '#ebebe6',
      text: '#1f1f1f',
      heading: '#0a0a0a',
      muted: '#6b6b68',
      warn: '#d9480f',
      divider: '#d6d6d0',
      codeBg: '#0a0a0a',
      codeText: '#ecece6',
      imageRadius: '0px',
      imageBorder: '1px solid #d6d6d0',
      bodyFont: SANS,
      headingFont: SANS,
      codeFont: MONO,
      headingWeight: '300',
      displayWeight: '300',
      displayTracking: '0.01em',
    },
    accents: [
      { id: 'lime', name: '荧光绿', accent: '#c2e62b', onAccent: '#0a0a0a', accentInk: '#4f6600', marker: 'rgba(194, 230, 43, 0.62)' },
      { id: 'ikb', name: '克莱因蓝', accent: '#002fa7', onAccent: '#ffffff', marker: 'rgba(0, 47, 167, 0.16)' },
      { id: 'lemon', name: '柠檬黄', accent: '#ffd500', onAccent: '#0a0a0a', accentInk: '#6b5600', marker: 'rgba(255, 213, 0, 0.52)' },
      { id: 'orange', name: '安全橙', accent: '#ff6b35', onAccent: '#ffffff', accentInk: '#c2410c', marker: 'rgba(255, 107, 53, 0.22)' },
    ],
  },
  {
    id: 'paper',
    name: '论文',
    mode: 'paper',
    description: '暖纸底、衬线标题、主色管结构、橙色管提醒，信息密、层级清楚。原理科普、架构解析、评测对比优先选它',
    coverVariants: ['digest', 'checklist', 'headline'],
    tokens: {
      bg: '#f6f3ec',
      surface: '#fffdf8',
      text: '#2b2a27',
      heading: '#111111',
      muted: '#7d776d',
      warn: '#dd5b2b',
      divider: '#d9d3c7',
      codeBg: '#fffdf8',
      codeText: '#2b2a27',
      imageRadius: '4px',
      imageBorder: '1px solid #d9d3c7',
      bodyFont: SANS,
      headingFont: SERIF,
      codeFont: MONO,
      headingWeight: '700',
      displayWeight: '700',
      displayTracking: '0.02em',
    },
    accents: [
      { id: 'blue', name: '学术蓝', accent: '#2f6bd8', onAccent: '#ffffff', marker: 'rgba(47, 107, 216, 0.14)' },
      { id: 'green', name: '墨绿', accent: '#1f7a5a', onAccent: '#ffffff', marker: 'rgba(31, 122, 90, 0.14)' },
      { id: 'violet', name: '靛紫', accent: '#5b4fc4', onAccent: '#ffffff', marker: 'rgba(91, 79, 196, 0.14)' },
    ],
  },
];

/** 新稿子的默认主题。列表顺序只影响选择器，不跟着第一项走 */
export const DEFAULT_THEME_ID = 'swiss';

export function findTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0]!;
}

export function findAccent(theme: Theme, id: string | undefined): ThemeAccent {
  return theme.accents.find((a) => a.id === id) ?? theme.accents[0]!;
}

export const MODE_LABELS: Record<ThemeMode, string> = {
  swiss: '瑞士国际',
  paper: '论文科普',
  memo: '手帐笔记',
  neon: '暗夜极客',
  pop: '波普撞色',
};

/** 下线的旧主题 id → 新主题和强调色。旧稿子打开时按原来的体系落到新主题上，不出现空白 */
export const LEGACY_THEMES: Record<string, { themeId: string; accentId: string }> = {
  'swiss-ikb': { themeId: 'swiss', accentId: 'ikb' },
  'swiss-lemon': { themeId: 'swiss', accentId: 'lemon' },
  'swiss-orange': { themeId: 'swiss', accentId: 'orange' },
  'ed-ink': { themeId: 'paper', accentId: 'blue' },
  'ed-indigo': { themeId: 'paper', accentId: 'blue' },
  'ed-midnight': { themeId: 'paper', accentId: 'blue' },
};
