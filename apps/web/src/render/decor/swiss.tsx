import { PAGE_H, PAGE_W } from '@rcs/shared';
import { CropMarks, Piece, pick } from './shapes';
import type { DecorSet } from './types';

/** 瑞士：印刷品的裁切线和细线圆，强调色只落在一个实心几何块上 */

export const swissDecor: DecorSet = {
  cover: () => (
    <>
      <CropMarks />
      <Piece x={760} y={96} w={320} h={330}>
        <circle className="s-ink" cx={180} cy={160} r={150} fill="none" strokeWidth={1.5} />
        <path className="s-ink" d="M180 0V320M20 160H320" strokeWidth={1} />
        <circle className="f-accent" cx={262} cy={268} r={48} />
      </Piece>
    </>
  ),
  page: (pageNo) => (
    <>
      <CropMarks />
      {pick(pageNo, [
        <Piece key="arc" x={PAGE_W - 70} y={PAGE_H - 420} w={70} h={160}>
          <circle className="f-marker" cx={70} cy={80} r={66} />
          <circle className="s-ink" cx={70} cy={80} r={46} fill="none" strokeWidth={1.5} />
          <path className="s-ink" d="M70 0V160" strokeWidth={1} />
        </Piece>,
        <Piece key="block" x={1024} y={140} w={36} h={60}>
          <rect className="f-accent" width={36} height={36} />
          <path className="s-ink" d="M0 54H36" strokeWidth={1.5} />
        </Piece>,
      ])}
    </>
  ),
};
