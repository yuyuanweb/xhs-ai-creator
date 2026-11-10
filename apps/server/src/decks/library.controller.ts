import { Controller, Get, UseGuards } from '@nestjs/common';
import { DecksService } from './decks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.decks.library(user.id);
  }
}
