import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { DecksService, DeckPatch } from './decks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body('articleId') articleId: string) {
    return this.decks.create(articleId, user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('articleId') articleId: string) {
    return this.decks.listByArticle(articleId, user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.decks.get(id, user.id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() patch: DeckPatch) {
    return this.decks.update(id, user.id, patch);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.decks.remove(id, user.id);
    return { ok: true };
  }
}
