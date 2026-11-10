const CJK = /[\u4e00-\u9fff]/;

/**
 * 卡片上的引号统一成中文双引号。规则里用「」标注例子，模型常把它原样带进正文；
 * 英文直引号只在夹着中文时才换，免得误伤代码、命令里的引号
 */
export function normalizeQuotes(text: string): string {
  const out = text.replace(/「/g, '“').replace(/」/g, '”').replace(/『/g, '‘').replace(/』/g, '’');
  return CJK.test(out) ? out.replace(/"([^"\n]*)"/g, '“$1”') : out;
}
