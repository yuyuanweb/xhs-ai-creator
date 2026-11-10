import { Fragment } from 'react';
import { PAGE_W } from '@rcs/shared';
import { Piece, pick, sparkle, squiggle } from './shapes';
import type { DecorSet } from './types';

/** 手帐：角落里是手绘的星星、爱心、箭头和回形针，像随手画在本子上的涂鸦 */

function PaperClip({ x, y, rotate }: { x: number; y: number; rotate: number }) {
  return (
    <Piece x={x} y={y} w={48} h={150} rotate={rotate}>
      <path
        className="s-muted"
        d="M16 44V116a8 8 0 0 0 16 0V26a14 14 0 0 0-28 0V122a20 20 0 0 0 40 0V44"
        fill="none"
        strokeWidth={4.5}
      />
    </Piece>
  );
}

/** 一笔画的五角星，故意不闭合得太整齐 */
function DoodleStar({ x, y }: { x: number; y: number }) {
  return (
    <Piece x={x} y={y} w={130} h={120}>
      <path
        className="f-marker s-accent-ink"
        d="M52 12C56 30 60 40 64 50C78 50 90 50 102 52C92 60 84 68 76 76C80 90 84 100 86 112C74 104 64 98 54 92C44 100 34 106 22 112C26 100 30 88 34 76C24 68 16 62 6 54C20 52 32 50 44 50C46 38 48 26 52 12Z"
        strokeWidth={4}
      />
      <path className="s-accent-ink" d="M108 18l10-10M114 34l14-2M98 6l2-6" fill="none" strokeWidth={4} />
    </Piece>
  );
}

function Heart({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <Piece x={x} y={y} w={size} h={size}>
      <path
        className="f-accent s-ink"
        transform={`scale(${size / 40})`}
        d="M20 35C8 26 3 19 4 12C5 6 12 3 17 7C18.5 8 19.5 9.5 20 11C20.5 9.5 21.5 8 23 7C28 3 35 6 36 12C37 19 32 26 20 35Z"
        strokeWidth={2.4}
      />
    </Piece>
  );
}

/** 绕一个圈再往左下指的手绘箭头 */
function CurlyArrow({ x, y }: { x: number; y: number }) {
  return (
    <Piece x={x} y={y} w={150} h={180}>
      <path
        className="s-ink"
        d="M128 10C132 50 110 80 86 74C66 68 70 44 88 46C108 48 108 90 86 116C70 136 46 150 22 160"
        fill="none"
        strokeWidth={4.5}
      />
      <path className="s-ink" d="M44 138L20 161L52 166" fill="none" strokeWidth={4.5} />
    </Piece>
  );
}

/** 从右页边探出来的一枚索引标签 */
function IndexTab({ y, pageNo }: { y: number; pageNo: number }) {
  return (
    <Piece x={PAGE_W - 34} y={y} w={34} h={96}>
      <rect className="f-accent" x={0} y={0} width={50} height={96} rx={12} />
      <path className="s-ink o-faint" d={`M12 ${30 + (pageNo % 3) * 12}h14`} strokeWidth={4} />
    </Piece>
  );
}

function Sparkles({ x, y }: { x: number; y: number }) {
  return (
    <Piece x={x} y={y} w={60} h={70}>
      <path className="f-accent" d={sparkle(22, 24, 20)} />
      <path className="f-accent-ink" d={sparkle(48, 56, 10)} />
    </Piece>
  );
}

export const memoDecor: DecorSet = {
  cover: (variant) => (
    <>
      <PaperClip x={22} y={-26} rotate={-8} />
      <DoodleStar x={918} y={108} />
      <Sparkles x={1012} y={560} />
      {variant === 'checklist' ? <CurlyArrow x={850} y={800} /> : null}
      <Piece x={760} y={1400} w={260} h={30}>
        <path className="s-accent-ink" d={squiggle(10, 15, 230, 5, 7)} fill="none" strokeWidth={4} />
      </Piece>
    </>
  ),
  page: (pageNo) =>
    pick(pageNo, [
      <Fragment key="star">
        <DoodleStar x={926} y={110} />
      </Fragment>,
      <Fragment key="heart">
        <IndexTab y={180} pageNo={pageNo} />
        <Heart x={968} y={1400} size={32} />
        <Piece x={780} y={1404} w={180} h={26}>
          <path className="s-accent-ink" d={squiggle(6, 13, 168, 4, 6)} fill="none" strokeWidth={3.5} />
        </Piece>
      </Fragment>,
      <Fragment key="clip">
        <PaperClip x={1012} y={-24} rotate={10} />
        <Sparkles x={1010} y={1180} />
      </Fragment>,
    ]),
};
