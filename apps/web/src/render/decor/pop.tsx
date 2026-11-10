import { Fragment } from 'react';
import { PAGE_W } from '@rcs/shared';
import { Piece, pick, sparkle, squiggle, starburst } from './shapes';
import type { DecorSet } from './types';

/** 波普：描黑边的爆炸贴纸、闪光星、从页边探出来的半圆，和一条压在页脚下的波浪线，全是撞色实心块 */

function Burst({ x, y, r, spikes, rotate }: { x: number; y: number; r: number; spikes: number; rotate?: number }) {
  const size = r * 2 + 12;
  const c = size / 2;
  return (
    <Piece x={x} y={y} w={size} h={size} rotate={rotate}>
      <polygon className="f-accent s-ink" points={starburst(c, c, r, r * 0.76, spikes)} strokeWidth={4} />
      <circle className="s-ink" cx={c} cy={c} r={r * 0.46} fill="none" strokeWidth={3} strokeDasharray="2 9" />
    </Piece>
  );
}

function Sparkles({ x, y }: { x: number; y: number }) {
  return (
    <Piece x={x} y={y} w={80} h={110}>
      <path className="f-accent s-ink" d={sparkle(44, 40, 36)} strokeWidth={3} />
      <path className="f-ink" d={sparkle(16, 92, 14)} />
    </Piece>
  );
}

function BottomSquiggle({ x, width }: { x: number; width: number }) {
  return (
    <Piece x={x} y={1402} w={width} h={30}>
      <path className="s-ink" d={squiggle(4, 15, width - 8, 5, Math.round(width / 36))} fill="none" strokeWidth={4} />
    </Piece>
  );
}

/** 右页边探出来的半个色块圆，上面三颗黑点 */
function EdgeMoon({ y }: { y: number }) {
  return (
    <Piece x={PAGE_W - 72} y={y} w={72} h={220}>
      <circle className="f-accent s-ink" cx={110} cy={150} r={80} strokeWidth={4} />
      {[0, 1, 2].map((i) => (
        <circle key={i} className="f-ink" cx={40} cy={16 + i * 24} r={6} />
      ))}
    </Piece>
  );
}

export const popDecor: DecorSet = {
  cover: () => (
    <>
      <Burst x={786} y={112} r={136} spikes={18} rotate={-8} />
      <Sparkles x={990} y={600} />
      <Piece x={14} y={640} w={50} h={50}>
        <path className="f-ink" d={sparkle(25, 25, 20)} />
      </Piece>
      <BottomSquiggle x={72} width={260} />
    </>
  ),
  page: (pageNo) =>
    pick(pageNo, [
      <Fragment key="sparkle">
        <Sparkles x={986} y={110} />
        <BottomSquiggle x={72} width={220} />
      </Fragment>,
      <Fragment key="moon">
        <EdgeMoon y={1060} />
      </Fragment>,
      <Fragment key="burst">
        <Burst x={968} y={104} r={50} spikes={14} rotate={12} />
        <BottomSquiggle x={740} width={190} />
      </Fragment>,
    ]),
};
