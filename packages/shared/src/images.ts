/** 图注、「留空」这类写给自己看的备注 */
const META_PART = /^\s*(图注|图说)\s*[:：]|图注|留空/;
/** 整段只是一行出处 */
const SOURCE_LINE = /^\s*(来源|数据来源|出处|参考)\s*[:：]/;

/**
 * 正文里只留给读者看的话。模型会顺手写「来源：…｜图注：xx 示意图」「图注未提供，留空」，
 * 前者是一行没人看的出处，后者是写给自己的备注，那张图往往也根本没放进来。
 * 图注只能长在图片块上；整段只剩出处时返回空串，调用方据此丢掉这一块
 */
export function cleanBodyText(text: string): string {
  const parts = text.split(/\s*[｜|；;]\s*/).filter(Boolean);
  const kept = parts.filter((part) => !META_PART.test(part));
  const out = kept.length === parts.length ? text.trim() : kept.join('；').trim();
  return SOURCE_LINE.test(out) ? '' : out;
}
