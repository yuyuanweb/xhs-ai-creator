import { Module } from '@nestjs/common';
import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';
import { LibraryController } from './library.controller';
import { ArticlesModule } from '../articles/articles.module';

@Module({
  imports: [ArticlesModule],
  providers: [DecksService],
  controllers: [DecksController, LibraryController],
  exports: [DecksService],
})
export class DecksModule {}
