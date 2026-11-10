import { Global, Module } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { PromptsController } from './prompts.controller';

@Global()
@Module({
  providers: [PromptsService],
  controllers: [PromptsController],
  exports: [PromptsService],
})
export class PromptsModule {}
