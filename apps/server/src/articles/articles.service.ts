import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SourceArticle, SourceBlock, SourceImage } from '@rcs/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ImageFetcherService } from '../storage/image-fetcher.service';
import { newId } from '../common/id';
import { parseMarkdown } from './markdown-parser';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageFetcherService,
  ) {}

  async create(userId: string, markdown: string, titleOverride?: string): Promise<SourceArticle> {
    const parsed = parseMarkdown(markdown);
    const images = await this.transferImages(parsed.imageOrigins);

    const row = await this.prisma.article.create({
      data: {
        id: newId('a'),
        userId,
        title: titleOverride?.trim() || parsed.title,
        markdown,
        blocks: parsed.blocks as unknown as object,
        images: images as unknown as object,
      },
    });
    return toArticle(row);
  }

  /**
   * 抓取失败的图片仍然留一条记录，只是 url 为空。
   * 保住 origin 才有重新抓取的可能，丢了就只能回去翻原文。
   */
  private async transferImages(origins: string[]): Promise<SourceImage[]> {
    const results = await Promise.all(
      origins.map(async (origin, i): Promise<SourceImage> => {
        const fetched = await this.images.fetch(origin);
        return {
          id: `img${i}`,
          origin,
          url: fetched?.url ?? '',
          width: fetched?.width ?? 0,
          height: fetched?.height ?? 0,
        };
      }),
    );

    const failed = results.filter((r) => !r.url).length;
    if (failed) this.logger.warn(`${origins.length} 张配图中有 ${failed} 张抓取失败`);
    return results;
  }

  async retryImages(id: string, userId: string): Promise<SourceArticle> {
    const article = await this.get(id, userId);
    const images = await Promise.all(
      article.images.map(async (img) => {
        if (img.url) return img;
        const fetched = await this.images.fetch(img.origin);
        return fetched ? { ...img, ...fetched } : img;
      }),
    );

    const row = await this.prisma.article.update({
      where: { id },
      data: { images: images as unknown as object },
    });
    return toArticle(row);
  }

  async list(userId: string) {
    const rows = await this.prisma.article.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async get(id: string, userId: string): Promise<SourceArticle> {
    const row = await this.prisma.article.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('文章不存在');
    return toArticle(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    const { count } = await this.prisma.article.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('文章不存在');
  }
}

type ArticleRow = {
  id: string;
  title: string;
  markdown: string;
  blocks: unknown;
  images: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toArticle(row: ArticleRow): SourceArticle {
  return {
    id: row.id,
    title: row.title,
    markdown: row.markdown,
    blocks: row.blocks as SourceBlock[],
    images: row.images as SourceImage[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
