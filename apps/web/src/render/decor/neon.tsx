import { Fragment } from 'react';
import { PAGE_H } from '@rcs/shared';
import { Piece, pick } from './shapes';
import type { DecorSet } from './types';

/** 暗夜：沿页边走的电路线、发光的节点和标题后面的轨道环 */

/** 走线从右上角进来，沿页眉上方和右页边拐弯，末端一颗节点 */
function TraceTopRight() {
  return (
    <Piece x={880} y={0} w={200} h={300} className="o-trace">
      <g className="s-accent" fill="none" strokeWidth={2}>
        <path d="M200 34H140L120 14H40" />
        <path d="M172 0V112L152 132V250" />
        <path d="M200 170H186V286" />
      </g>
      <circle className="f-bg s-accent" cx={40} cy={14} r={5} strokeWidth={2} />
      <circle className="f-accent dc-glow" cx={152} cy={254} r={6} />
      <circle className="f-bg s-accent" cx={186} cy={290} r={4} strokeWidth={2} />
    </Piece>
  );
}

function TraceBottomLeft() {
  return (
    <Piece x={0} y={PAGE_H - 320} w={240} h={320} className="o-trace">
      <g className="s-accent" fill="none" strokeWidth={2}>
        <path d="M0 296H90L110 316H220" />
        <path d="M30 320V200L48 182V40" />
      </g>
      <circle className="f-accent dc-glow" cx={48} cy={36} r={6} />
      <circle className="f-bg s-accent" cx={224} cy={316} r={4} strokeWidth={2} />
    </Piece>
  );
}

/** 斜着的两圈轨道和一颗发光的星球，衬在封面标题后面 */
function Orbits() {
  return (
    <Piece x={600} y={80} w={480} h={460}>
      <g className="s-accent o-faint" fill="none" strokeWidth={2}>
        <ellipse cx={290} cy={220} rx={220} ry={66} transform="rotate(-22 290 220)" />
        <ellipse cx={290} cy={220} rx={190} ry={54} transform="rotate(38 290 220)" strokeDasharray="2 10" />
        <circle cx={290} cy={220} r={120} strokeDasharray="1 8" />
      </g>
      <circle className="f-accent dc-glow" cx={290} cy={220} r={30} />
      <circle className="f-accent dc-glow" cx={92} cy={300} r={7} />
      <circle className="f-ink" cx={430} cy={92} r={5} />
    </Piece>
  );
}

/** 页边上的十字准星，一列三个 */
function Crosshairs() {
  return (
    <Piece x={1024} y={150} w={36} h={240} className="o-trace">
      {[0, 1, 2].map((i) => (
        <path key={i} className="s-accent" d={`M18 ${i * 100 + 6}v24M6 ${i * 100 + 18}h24`} strokeWidth={2} />
      ))}
    </Piece>
  );
}

export const neonDecor: DecorSet = {
  cover: () => (
    <>
      <Orbits />
      <TraceTopRight />
      <TraceBottomLeft />
    </>
  ),
  page: (pageNo) =>
    pick(pageNo, [
      <Fragment key="trace">
        <TraceTopRight />
        <TraceBottomLeft />
      </Fragment>,
      <Crosshairs key="cross" />,
    ]),
};
