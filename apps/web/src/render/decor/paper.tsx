import { Piece } from './shapes';
import type { DecorSet } from './types';

/** 论文：封面标题后面一张淡淡的尺规作图，像教科书的插图；内页不加装饰，留给正文 */

/** 同心圆、放射线和内接三角，标题后面的一张几何插图 */
function CompassPlate() {
  const c = 180;
  const rays = Array.from({ length: 12 }, (_, i) => (Math.PI * i) / 6);
  const tri = [0, 1, 2].map((i) => {
    const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
    return `${c + 170 * Math.cos(a)},${c + 170 * Math.sin(a)}`;
  });
  return (
    <Piece x={720} y={110} w={360} h={360} className="o-faint">
      <g className="s-accent-ink" fill="none" strokeWidth={1.5}>
        <circle cx={c} cy={c} r={170} />
        <circle cx={c} cy={c} r={118} strokeDasharray="4 6" />
        <circle cx={c} cy={c} r={62} />
        <polygon points={tri.join(' ')} />
        {rays.map((a, i) => (
          <path key={i} d={`M${c + 62 * Math.cos(a)} ${c + 62 * Math.sin(a)}L${c + 170 * Math.cos(a)} ${c + 170 * Math.sin(a)}`} strokeWidth={1} />
        ))}
      </g>
      <circle className="f-accent" cx={c} cy={c} r={7} />
    </Piece>
  );
}

export const paperDecor: DecorSet = {
  cover: () => <CompassPlate />,
  page: () => null,
};
