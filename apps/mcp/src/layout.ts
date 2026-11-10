import type { ExternalLayout, ExternalReviseResult, LayoutSnapshot } from '@rcs/shared';
import type { StudioApi } from './api.js';

/** 编辑台重新加载、测高、回传一轮大约两三秒，留足余量 */
const WAIT_MS = 25000;
const POLL_MS = 1000;

/** 交稿或改稿后编辑台要先轮询到修订号、重新加载、测完高才回传，期间读到的都是旧快照，要等它跟上 */
export async function waitForLayout(api: StudioApi, deckId: string): Promise<ExternalLayout> {
  const deadline = Date.now() + WAIT_MS;
  let layout = await api.layout(deckId);
  while (layout.status !== 'fresh' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    layout = await api.layout(deckId);
  }
  return layout;
}

/** 交稿、改稿后直接附上实测排版。体检结果放进同一次返回，模型就没法跳过检查直接收工 */
export async function checkLayout(api: StudioApi, deckId: string): Promise<string> {
  return describeLayout(await waitForLayout(api, deckId));
}

export function describeLayout(layout: ExternalLayout): string {
  if (layout.status === 'missing') {
    return `编辑台还没打开过这份稿，量不到真实排版。请用户在浏览器打开 ${layout.editorUrl} 并让这个标签页留在前台，然后再调用 get_layout。`;
  }
  if (layout.status === 'stale' || !layout.snapshot) {
    return `编辑台还没量完最新这版。浏览器标签页在后台时会暂停测高，请用户把 ${layout.editorUrl} 切到前台，然后再调用 get_layout。`;
  }

  const { snapshot } = layout;
  const lines = [summaryOf(snapshot), '', '# 每页一览（index 0 是封面后的第一页，也就是第 2 张）', ...pagesOf(snapshot)];

  if (!layout.todo) {
    lines.push('', `排版指标和文案检查已全部达标，不用再改。把编辑台链接交给用户：${layout.editorUrl}`);
    return lines.join('\n');
  }

  lines.push(
    '',
    '# 这一轮要做',
    layout.todo,
    '排版或文案还没达标，这份稿子还没写完，不要停下。只改上面点到的页和块，已经合格的一块都不要动。用 revise_blocks 按块 id 打补丁，它的返回会附上改完之后的实测排版；一直改到全部达标，或者连续两轮都改不动了，再把编辑台链接交给用户。',
    '',
    '# 问题页上的块（完整内容，replace 时以此为底稿修改，不要只凭摘要重写）',
    JSON.stringify(layout.problemBlocks ?? [], null, 2),
  );
  if (snapshot.unusedImages.length) {
    lines.push('', '# 还没用上的原文截图（id｜所属原文节）', ...snapshot.unusedImages.map((img) => `${img.id}｜${img.source}`));
  }
  if (layout.rules) {
    lines.push(
      '',
      '# 修版规则',
      '下面是编辑台内置 AI 修版用的同一份规则。规则里的 measure_layout 对应这里的 get_layout，finish 对应停下来交给用户。',
      '',
      layout.rules,
    );
  }
  return lines.join('\n');
}

export function describeRevise(r: ExternalReviseResult): string {
  const lines = [`已生效 ${r.applied} 个补丁。`];
  if (r.skipped.length) lines.push('', '没生效或被修正的：', ...r.skipped.map((s) => `- ${s}`));
  if (!r.applied) lines.push('', '这次没有任何改动落库，按上面的原因调整补丁后再提交。');
  return lines.join('\n');
}

function summaryOf(snapshot: LayoutSnapshot): string {
  const r = snapshot.report;
  const parts = [
    `共 ${r.totalCards} 张（含封面）`,
    `平均填充 ${percent(r.avgFill)}`,
    `截图 ${r.imagesUsed} 张（合理区间 ${r.imagesMin}–${r.imagesMax}）`,
    r.overflowPages.length ? `装不下的页 index ${r.overflowPages.join('、')}` : '没有装不下的页',
    r.thinPages.length ? `过空页 index ${r.thinPages.join('、')}` : '没有过空页',
  ];
  if (r.exceedsPlatformLimit) parts.push('超过平台 18 张上限');
  else if (!r.withinTarget) parts.push('张数不在目标区间');
  return `编辑台实测排版：${parts.join('；')}`;
}

function pagesOf(snapshot: LayoutSnapshot): string[] {
  const { overflowPages, thinPages } = snapshot.report;
  return snapshot.pages.flatMap((p) => {
    const flag = overflowPages.includes(p.index) ? '【装不下】' : thinPages.includes(p.index) ? '【过空】' : '';
    return [
      `index ${p.index}（第 ${p.index + 2} 张）填充 ${percent(p.fill)}${flag}`,
      ...p.blocks.map((b) => `  - ${b.id}｜${b.kind}｜${b.text}${b.sources?.length ? `｜sources ${b.sources.join(',')}` : ''}`),
      ...(p.advice ? [`  advice：${p.advice}`] : []),
    ];
  });
}

function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}
