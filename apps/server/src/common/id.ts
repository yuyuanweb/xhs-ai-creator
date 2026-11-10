import { randomUUID } from 'node:crypto';

/** 实体 id：短、无歧义、可直接进 URL */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
