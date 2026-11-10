import { upgradeBlocks } from './blocks.js';
import { upgradeSettings } from './defaults.js';
import type { Deck } from './types/deck.js';

/**
 * 一版内页排版的指纹。编辑台回传测高结果时带上它，服务端拿库里的稿子算一遍对得上，才说明快照量的就是当前这版。
 * 两边各自先走一遍读库时的清洗再取值，否则编辑台里没清洗过的文字会让快照永远对不上；封面不影响内页分页，不算进来
 */
export function layoutKey(deck: Pick<Deck, 'contentType' | 'blocks' | 'disabledBlockIds' | 'settings'>): string {
  const off = new Set(deck.disabledBlockIds);
  const payload = {
    contentType: deck.contentType,
    blocks: upgradeBlocks(deck.blocks.filter((b) => !off.has(b.id))),
    settings: upgradeSettings(deck.settings),
  };
  return hash(stableJson(payload));
}

/** Postgres 的 jsonb 会重排对象键，前端改过的块键序也不固定，只能按键名排序后再序列化 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** cyrb53：浏览器和 Node 都能同步算，碰撞率对一份稿子的版本比对足够低 */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
