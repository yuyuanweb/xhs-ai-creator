import { Injectable } from '@nestjs/common';
import type { LayoutUpload } from '@rcs/shared';

/**
 * 编辑台回传的测高快照，和外部 Agent 的改稿修订号。
 * 两者都是派生状态：快照编辑台一打开就会重新量、重新传，修订号只用来提醒开着的编辑台重新加载，
 * 所以只放内存，服务重启丢了也不影响稿子本身
 */
@Injectable()
export class DeckLayoutStore {
  private readonly uploads = new Map<string, LayoutUpload>();
  private readonly revisions = new Map<string, number>();

  saveLayout(deckId: string, upload: LayoutUpload): void {
    this.uploads.set(deckId, upload);
  }

  layout(deckId: string): LayoutUpload | undefined {
    return this.uploads.get(deckId);
  }

  /** 外部 Agent 写过稿后调用，开着的编辑台轮询到新值就会重新加载 */
  markExternalChange(deckId: string): void {
    this.revisions.set(deckId, Date.now());
  }

  externalRevision(deckId: string): number | null {
    return this.revisions.get(deckId) ?? null;
  }

  forget(deckId: string): void {
    this.uploads.delete(deckId);
    this.revisions.delete(deckId);
  }
}
