import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ArticlesModule } from './articles/articles.module';
import { DecksModule } from './decks/decks.module';
import { PromptsModule } from './prompts/prompts.module';
import { LlmModule } from './llm/llm.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    ArticlesModule,
    DecksModule,
    PromptsModule,
    LlmModule,
  ],
})
export class AppModule {}
