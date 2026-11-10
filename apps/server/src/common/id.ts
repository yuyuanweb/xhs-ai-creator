import { randomUUID } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** 实体 id：短、无歧义、可直接进 URL */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/** 块 id：会大量出现在发给模型的 JSON 里，越短越省 token */
export function newBlockId(seq: number): string {
  let n = seq;
  let s = '';
  do {
    s = ALPHABET[n % 36] + s;
    n = Math.floor(n / 36);
  } while (n > 0);
  return `b${s}`;
}
