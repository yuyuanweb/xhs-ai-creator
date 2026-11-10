import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsObject, IsString } from 'class-validator';
import type { DeckSync, LayoutSnapshot } from '@rcs/shared';
import { DecksService, DeckPatch } from './decks.service';
import { DeckLayoutStore } from './deck-layout.store';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

class LayoutUploadDto {
  @IsString()
  key: string;

  @IsObject()
  snapshot: LayoutSnapshot;
}

@Controller('decks')
@UseGuards(JwtAuthGuard)
export class DecksController {
  constructor(
    private readonly decks: DecksService,
    private readonly layouts: DeckLayoutStore,
  ) {}

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
    this.layouts.forget(id);
    return { ok: true };
  }

  @Put(':id/layout')
  async uploadLayout(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LayoutUploadDto) {
    await this.decks.get(id, user.id);
    this.layouts.saveLayout(id, { key: dto.key, snapshot: dto.snapshot });
    return { ok: true };
  }

  @Get(':id/sync')
  async sync(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<DeckSync> {
    await this.decks.get(id, user.id);
    return { externalRevision: this.layouts.externalRevision(id) };
  }
}
