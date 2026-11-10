import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { AgentService } from './agent.service';
import { ExternalDraftService } from './external-draft.service';
import { AgentController } from './agent.controller';
import { ArticlesModule } from '../articles/articles.module';
import { DecksModule } from '../decks/decks.module';

@Module({
  imports: [ArticlesModule, DecksModule],
  providers: [LlmService, AgentService, ExternalDraftService],
  controllers: [AgentController],
  exports: [LlmService],
})
export class LlmModule {}
