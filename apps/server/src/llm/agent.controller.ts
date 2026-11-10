import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import type { AgentMessage } from '@rcs/shared';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

class DraftDto {
  @IsOptional()
  @IsString()
  model?: string;
}

class StepDto {
  @IsArray()
  messages: AgentMessage[];

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

  @Post('decks/:deckId/step')
  step(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: StepDto) {
    return this.agent.step(deckId, user.id, dto.messages, dto.model);
  }
}
