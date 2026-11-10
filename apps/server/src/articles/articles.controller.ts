import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.service';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.articles.create(user.id, dto.markdown, dto.title);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.articles.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.get(id, user.id);
  }

  @Post(':id/retry-images')
  retryImages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.retryImages(id, user.id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.articles.remove(id, user.id);
    return { ok: true };
  }
}
