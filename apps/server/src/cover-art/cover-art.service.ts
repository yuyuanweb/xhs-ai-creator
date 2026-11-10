import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { coverArtOrigin, type CoverArtRequest, type CoverArtResult, type SourceArticle } from '@rcs/shared';
import { ArticlesService } from '../articles/articles.service';
import { DecksService } from '../decks/decks.service';
import { PromptsService } from '../prompts/prompts.service';
import { ImageFetcherService } from '../storage/image-fetcher.service';
import { buildCoverArtPrompt, splitTitleLines } from './cover-art-prompt';
import { GEMINI_INPUT_MIMES, GeminiImageService, type ImageInput } from './gemini-image.service';
import { loadHostPortrait } from './host-portrait';

/** 一次出几张候选。同一段提示词每次画出来差别很大，只出一张很难碰上满意的 */
const VARIANTS = 2;
export const MAX_REFERENCES = 3;
const MAX_TITLE_LINES = 3;

@Injectable()
export class CoverArtService {
  private readonly logger = new Logger(CoverArtService.name);

  constructor(
    private readonly decks: DecksService,
    private readonly articles: ArticlesService,
    private readonly prompts: PromptsService,
    private readonly images: ImageFetcherService,
    private readonly gemini: GeminiImageService,
  ) {}

  async generate(deckId: string, userId: string, req: CoverArtRequest): Promise<CoverArtResult> {
    const titleLines = splitTitleLines(req.title);
    if (!titleLines.length) throw new BadRequestException('先写好封面上的大字');
    if (titleLines.length > MAX_TITLE_LINES) throw new BadRequestException(`封面大字最多 ${MAX_TITLE_LINES} 行`);

    const deck = await this.decks.get(deckId, userId);
    const article = await this.articles.get(deck.articleId, userId);
    const picked = await this.loadReferences(article, req.referenceIds ?? []);
    const portrait = await loadHostPortrait();
    // 出镜人永远排第一张，提示词里按「第一张」来指他
    const references = portrait ? [portrait, ...picked] : picked;
    const prompt = buildCoverArtPrompt(await this.prompts.get('coverArt'), {
      titleLines,
      subject: req.subject,
      referenceCount: picked.length,
      hostPortrait: !!portrait,
      articleTitle: article.title,
      cover: deck.cover,
    });

    const results = await Promise.allSettled(
      Array.from({ length: VARIANTS }, () => this.gemini.generate(prompt, { aspectRatio: '3:4', references })),
    );
    const drawn = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (!drawn.length) {
      const reason = (results[0] as PromiseRejectedResult).reason;
      throw reason instanceof Error ? reason : new InternalServerErrorException('封面图生成失败');
    }
    if (drawn.length < VARIANTS) this.logger.warn(`封面图只画成了 ${drawn.length}/${VARIANTS} 张`);

    const alt = titleLines.join(' ');
    const { article: next, added } = await this.articles.attachImages(
      article.id,
      userId,
      'art',
      drawn.map((img) => ({ buffer: img.data, mime: img.mime, origin: coverArtOrigin(), alt })),
    );
    return { article: next, imageIds: added.map((img) => img.id) };
  }

  private async loadReferences(article: SourceArticle, ids: string[]): Promise<ImageInput[]> {
    const picked = [...new Set(ids)].slice(0, MAX_REFERENCES).map((id) => {
      const img = article.images.find((i) => i.id === id);
      if (!img?.url) throw new BadRequestException('参考图不存在或没抓取成功');
      return img;
    });
    const loaded = await Promise.all(picked.map((img) => this.images.readStored(img.url)));
    if (loaded.some((img) => !GEMINI_INPUT_MIMES.has(img.mime))) {
      throw new BadRequestException('参考图只支持 PNG、JPEG、WebP');
    }
    return loaded;
  }
}
