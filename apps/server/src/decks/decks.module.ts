import { Module } from '@nestjs/common';
import { DecksService } from './decks.service';
import { DecksController } from './decks.controller';
import { DeckLayoutStore } from './deck-layout.store';
import { LibraryController } from './library.controller';
import { ArticlesModule } from '../articles/articles.module';

@Module({
  imports: [ArticlesModule],
  providers: [DecksService, DeckLayoutStore],
  controllers: [DecksController, LibraryController],
  exports: [DecksService, DeckLayoutStore],
})
export class DecksModule {}
