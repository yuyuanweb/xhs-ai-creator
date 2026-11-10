import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import type { AgentMessage, BlockPatch } from '@rcs/shared';
import { AgentService } from './agent.service';
import { ExternalDraftService } from './external-draft.service';
import type { RawBlock } from './draft-blocks';
import type { RawDraft } from './draft-spec';
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

class ImportDraftDto {
  @IsObject()
  draft: RawDraft;
}

class SupplementDto {
  @IsArray()
  blocks: RawBlock[];
}

class ReviseDto {
  @IsArray()
  patches: BlockPatch[];
}

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly external: ExternalDraftService,
  ) {}

  @Post('decks/:deckId/draft')
  draft(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: DraftDto) {
    return this.agent.draft(deckId, user.id, dto.model);
  }

  @Post('decks/:deckId/step')
  step(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: StepDto) {
    return this.agent.step(deckId, user.id, dto.messages, dto.model);
  }

  @Get('decks/:deckId/brief')
  brief(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string) {
    return this.external.brief(deckId, user.id);
  }

  @Post('decks/:deckId/import')
  importDraft(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: ImportDraftDto) {
    return this.external.importDraft(deckId, user.id, dto.draft);
  }

  @Post('decks/:deckId/supplement')
  supplement(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: SupplementDto) {
    return this.external.supplement(deckId, user.id, dto.blocks);
  }

  @Get('decks/:deckId/layout')
  layout(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string) {
    return this.external.layout(deckId, user.id);
  }

  @Post('decks/:deckId/revise')
  revise(@CurrentUser() user: AuthUser, @Param('deckId') deckId: string, @Body() dto: ReviseDto) {
    return this.external.revise(deckId, user.id, dto.patches);
  }
}
