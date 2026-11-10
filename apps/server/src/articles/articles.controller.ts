import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('请选择一张图片');
    return this.articles.addImage(id, user.id, file);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.articles.remove(id, user.id);
    return { ok: true };
  }
}
