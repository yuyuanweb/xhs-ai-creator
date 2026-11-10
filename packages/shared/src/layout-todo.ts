import { copyIssues, describeCopyIssues } from './copy-style.js';
import type { LayoutSnapshot } from './types/agent.js';
import type { CardBlock } from './types/deck.js';
import { imageGap, isLayoutHealthy } from './types/layout.js';

/** 排版达标、文案也没有查得出来的 AI 腔，这份稿子才算改完 */
export function isRevisionDone(snapshot: LayoutSnapshot, blocks: CardBlock[]): boolean {
  return isLayoutHealthy(snapshot.report) && !copyIssues(blocks).length;
}

/** 按体检结果逐条点名这一轮要做什么。笼统地说「修一下」，模型常常只挑最省事的一条做 */
export function layoutTodo(snapshot: LayoutSnapshot, blocks: CardBlock[]): string {
  const r = snapshot.report;
  const todo: string[] = [];

  if (r.overflowPages.length) {
    todo.push(`index 为 ${r.overflowPages.join('、')} 的页装不下，先把这几页的段落和组件条目删短，或拆开挪到下一页`);
  }
  if (r.thinPages.length) {
    todo.push(
      `index 为 ${r.thinPages.join('、')} 的页过空，照各页的 advice 做：原文这一节有没用上的截图就先补截图，其次加组件，再次扩写；原文这一节确实没有更多内容时，才把本页 h2 setBreak join 进上一页`,
    );
  }
  const gap = imageGap(r);
  if (gap > 0) {
    todo.push(
      `现在只用了 ${r.imagesUsed} 张原文截图，还要补 ${gap} 张：从 unusedImages 里挑前后文讲清了画面是什么的截图，insert 到它在原文里所属那一节、介绍它的那段 p 后面；前后文没讲清是什么的图宁可不补`,
    );
  }
  if (gap < 0) {
    todo.push(
      `截图用了 ${r.imagesUsed} 张，超过上限 ${r.imagesMax} 张，remove 掉 ${-gap} 张信息量最小的，腾出的空间用组件补上`,
    );
  }
  if (r.exceedsPlatformLimit || !r.withinTarget) {
    todo.push(`现在一共 ${r.totalCards} 张，不在目标区间，合并内容少的相邻章节或删掉次要的页`);
  }
  const issues = copyIssues(blocks);
  if (issues.length) todo.push(describeCopyIssues(issues));

  return todo.map((t, i) => `${i + 1}. ${t}`).join('\n');
}
