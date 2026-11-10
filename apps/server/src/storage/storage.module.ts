import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { ImageFetcherService } from './image-fetcher.service';

@Global()
@Module({
  providers: [
    { provide: StorageService, useClass: LocalStorageService },
    ImageFetcherService,
  ],
  exports: [StorageService, ImageFetcherService],
})
export class StorageModule {}
