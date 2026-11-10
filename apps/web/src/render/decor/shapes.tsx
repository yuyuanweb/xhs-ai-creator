import type { ReactNode } from 'react';
import { PAGE_H, PAGE_W } from '@rcs/shared';

/**
 * 一块装饰画布，坐标直接用卡片像素：x / y 是左上角在 1080×1440 卡片上的位置，
 * 里面的图形也按像素画（viewBox 和宽高一致），摆位置时不用换算。
 */
export function Piece({
  x,
  y,
  w,
  h,
  rotate,
  className,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={`dc${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ left: x, top: y, transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** 四角的裁切线，落在页眉上方和左右页边的留白里 */
export function CropMarks({ inset = 26, arm = 22 }: { inset?: number; arm?: number }) {
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [PAGE_W - inset, inset, -1, 1],
    [inset, PAGE_H - inset, 1, -1],
    [PAGE_W - inset, PAGE_H - inset, -1, -1],
  ];
  return (
    <Piece x={0} y={0} w={PAGE_W} h={PAGE_H}>
      {corners.map(([x, y, dx, dy], i) => (
        <path key={i} className="s-ink" strokeWidth={1.5} fill="none" d={`M${x} ${y + dy * arm}V${y}H${x + dx * arm}`} />
      ))}
    </Piece>
  );
}

/** 四角内凹的闪光星 */
export function sparkle(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
}

/** 爆炸贴纸的锯齿轮廓：内外两圈半径交替连线 */
export function starburst(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 一条水平的波浪线 */
export function squiggle(x: number, y: number, length: number, amp: number, waves: number): string {
  const step = length / (waves * 2);
  let d = `M${x} ${y}`;
  for (let i = 0; i < waves * 2; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    d += `Q${x + step * i + step / 2} ${y + dir * amp * 2} ${x + step * (i + 1)} ${y}`;
  }
  return d;
}

/** 按页码轮换版式，相邻两页不会长得一样 */
export function pick<T>(n: number, options: T[]): T {
  return options[n % options.length]!;
}
