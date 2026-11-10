import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { DecksModule } from '../decks/decks.module';
import { CoverArtController } from './cover-art.controller';
import { CoverArtService } from './cover-art.service';
import { GeminiImageService } from './gemini-image.service';

@Module({
  imports: [ArticlesModule, DecksModule],
  providers: [CoverArtService, GeminiImageService],
  controllers: [CoverArtController],
})
export class CoverArtModule {}
