const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 「刚刚 / 5 分钟前 / 昨天 14:20 / 10月8日」这一档的相对时间 */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso);
  const diff = now - t.getTime();
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  const hm = t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (t.getTime() >= today.getTime()) return `今天 ${hm}`;
  if (t.getTime() >= today.getTime() - DAY) return `昨天 ${hm}`;
  const start = new Date(t);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - start.getTime()) / DAY);
  if (days < 7) return `${days} 天前`;
  const sameYear = t.getFullYear() === today.getFullYear();
  return t.toLocaleDateString('zh-CN', sameYear ? { month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' });
}

export function fullTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}
