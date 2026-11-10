import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

class DraftDto {
  @IsOptional()
  @IsString()
  model?: string;
}

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('decks/:deckId/draft')
  draft(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: DraftDto) {
    return this.agent.draft(deckId, user.id, dto.model);
  }
}
