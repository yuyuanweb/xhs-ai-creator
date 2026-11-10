import { Controller, Get, UseGuards } from '@nestjs/common';
import { DecksService } from './decks.service';
import { DeckLayoutStore } from './deck-layout.store';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(
    private readonly decks: DecksService,
    private readonly layouts: DeckLayoutStore,
  ) {}

  /** 排版状态只在编辑台打开过、回传过测高之后才有，服务重启后为空 */
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.decks.library(user.id);
    return items.map((item) => {
      const report = item.deck ? this.layouts.layout(item.deck.id)?.snapshot.report : undefined;
      return {
        ...item,
        layout: report
          ? { cards: report.totalCards, thin: report.thinPages.length, overflow: report.overflowPages.length }
          : null,
      };
    });
  }
}
