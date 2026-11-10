import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { PromptsService } from './prompts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdatePromptDto {
  @IsString()
  content: string;
}

@Controller('prompts')
@UseGuards(JwtAuthGuard)
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Get()
  list() {
    return this.prompts.list();
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() dto: UpdatePromptDto) {
    return this.prompts.update(key, dto.content);
  }

  @Post(':key/reset')
  reset(@Param('key') key: string) {
    return this.prompts.reset(key);
  }
}
