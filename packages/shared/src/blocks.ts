import type { CardBlock, CardBlockKind } from './types/deck.js';
import { cleanBodyText } from './images.js';

const TEXT_KINDS: CardBlockKind[] = ['p', 'quote', 'callout'];

/**
 * 条形图的取值：value 里恰好有一个数字才能画成长短可比的条，「70–500ms」这种区间没法画。
 * 千分位逗号先去掉，免得「1,200」被拆成两个数
 */
export function chartValue(value: string | undefined): number | undefined {
  const nums = (value ?? '').replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g);
  return nums?.length === 1 ? Number(nums[0]) : undefined;
}

/**
 * 读出库里的块时过一遍清洗：老稿子里的出处小字、「图注留空」这类备注直接去掉，洗空的块整块丢掉；
 * 老稿子 h2 上方的引题也一并摘掉
 */
export function upgradeBlocks(raw: unknown): CardBlock[] {
  if (!Array.isArray(raw)) return [];
  return (raw as CardBlock[]).flatMap((b) => {
    if (b.kind === 'h2' && b.label !== undefined) {
      const { label: _label, ...rest } = b;
      return [rest];
    }
    if (!TEXT_KINDS.includes(b.kind) || typeof b.text !== 'string') return [b];
    const text = cleanBodyText(b.text);
    return text ? [{ ...b, text }] : [];
  });
}
