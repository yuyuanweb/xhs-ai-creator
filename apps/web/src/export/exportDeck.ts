import { domToPng } from 'modern-screenshot';
import JSZip from 'jszip';
import { EXPORT_SCALE, PAGE_H, PAGE_W } from '@rcs/shared';

export interface ExportProgress {
  done: number;
  total: number;
  current: string;
}

export interface ExportOptions {
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
}

/**
 * 内容装不下这件事肉眼很难发现，尤其是被 overflow:hidden 悄悄裁掉的那种。
 * 导出前扫一遍，有溢出就先告诉用户，别让他把残缺的图发出去。
 */
export function detectClipping(root: HTMLElement): string[] {
  const issues: string[] = [];

  root.querySelectorAll<HTMLElement>('[data-card-name]').forEach((slot) => {
    const name = slot.dataset.cardName ?? '';
    slot.querySelectorAll<HTMLElement>('.c-body, .cv-body, .cv-slab').forEach((el) => {
      const over = el.scrollHeight - el.clientHeight;
      if (over > 2) issues.push(`${name} 有内容溢出 ${over}px`);
    });
  });

  return issues;
}

async function renderCard(card: HTMLElement): Promise<Blob> {
  const dataUrl = await domToPng(card, {
    scale: EXPORT_SCALE,
    width: PAGE_W,
    height: PAGE_H,
    // 字体必须内联进 SVG，否则导出图会回退到运行环境的字体
    font: {},
    features: { removeControlCharacter: false },
  });

  return await (await fetch(dataUrl)).blob();
}

/** 逐张截图后打包。用户拿到的是一个 zip，按文件名顺序就是发布顺序 */
export async function exportDeckToZip(root: HTMLElement, opts: ExportOptions = {}): Promise<Blob> {
  const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-card-name]'));
  if (!slots.length) throw new Error('没有可导出的卡片');

  const zip = new JSZip();

  for (let i = 0; i < slots.length; i++) {
    if (opts.signal?.aborted) throw new Error('导出已取消');

    const slot = slots[i]!;
    const name = slot.dataset.cardName ?? `${i + 1}`;
    const card = slot.querySelector<HTMLElement>('.card') ?? slot;

    opts.onProgress?.({ done: i, total: slots.length, current: name });
    zip.file(`${name}.png`, await renderCard(card));
  }

  opts.onProgress?.({ done: slots.length, total: slots.length, current: '打包中' });
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
