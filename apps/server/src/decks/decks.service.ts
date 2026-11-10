import { Injectable, NotFoundException } from '@nestjs/common';
import {
  defaultCover,
  defaultDeckSettings,
  upgradeAiSnapshot,
  upgradeBlocks,
  upgradeCover,
  upgradeOverlays,
  upgradeSettings,
  type AiSnapshot,
  type CardBlock,
  type ContentType,
  type CoverSpec,
  type Deck,
  type DeckSettings,
  type DeckStatus,
  type PageOverlay,
  type SourceImage,
} from '@rcs/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ArticlesService } from '../articles/articles.service';
import { newId } from '../common/id';

export interface DeckPatch {
  contentType?: ContentType;
  blocks?: CardBlock[];
  cover?: CoverSpec;
  settings?: DeckSettings;
  disabledBlockIds?: string[];
  overlays?: PageOverlay[];
  aiSnapshot?: AiSnapshot | null;
  status?: DeckStatus;
}

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlesService,
  ) {}

  async create(articleId: string, userId: string): Promise<Deck> {
    const article = await this.articles.get(articleId, userId);
    const settings = { ...defaultDeckSettings(), byline: await this.lastByline(userId) };
    const row = await this.prisma.deck.create({
      data: {
        id: newId('d'),
        articleId: article.id,
        contentType: 'opinion',
        blocks: [] as unknown as object,
        cover: defaultCover(article.title) as unknown as object,
        settings: settings as unknown as object,
        disabledBlockIds: [] as unknown as object,
        overlays: [] as unknown as object,
        status: 'draft',
      },
    });
    return toDeck(row);
  }

  async listByArticle(articleId: string, userId: string): Promise<Deck[]> {
    await this.articles.get(articleId, userId);
    const rows = await this.prisma.deck.findMany({
      where: { articleId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toDeck);
  }

  /** 作品库：每篇文章带上最近编辑的那份稿子，首页靠它画封面缩略图，不用逐篇再查 */
  async library(userId: string): Promise<Array<LibraryRow>> {
    const rows = await this.prisma.article.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        markdown: true,
        images: true,
        createdAt: true,
        updatedAt: true,
        decks: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    });
    const items = rows.map((r) => {
      const images = (r.images as SourceImage[] | null) ?? [];
      const row = r.decks[0];
      const deck = row ? toDeck(row) : null;
      const coverOverlays = deck?.overlays?.filter((o) => o.anchor === 'cover') ?? [];
      const used = new Set(coverOverlays.map((o) => o.imageId).filter(Boolean));
      return {
        articleId: r.id,
        title: r.title,
        chars: r.markdown.length,
        imageCount: images.length,
        createdAt: r.createdAt.toISOString(),
        updatedAt: (row && row.updatedAt > r.updatedAt ? row.updatedAt : r.updatedAt).toISOString(),
        deck: deck && {
          id: deck.id,
          status: deck.status,
          blockCount: deck.blocks.length,
          cover: deck.cover,
          settings: deck.settings,
          overlays: coverOverlays,
        },
        coverImages: images.filter((img) => used.has(img.id)),
      };
    });
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string, userId: string): Promise<Deck> {
    const row = await this.prisma.deck.findFirst({
      where: { id, article: { userId } },
    });
    if (!row) throw new NotFoundException('卡片稿不存在');
    return toDeck(row);
  }

  /** 前端是编排状态的唯一来源，整份覆盖比字段级合并更不容易出现状态分裂 */
  async update(id: string, userId: string, patch: DeckPatch): Promise<Deck> {
    await this.get(id, userId);
    const row = await this.prisma.deck.update({
      where: { id },
      data: {
        ...(patch.contentType !== undefined && { contentType: patch.contentType }),
        ...(patch.blocks !== undefined && { blocks: patch.blocks as unknown as object }),
        ...(patch.cover !== undefined && { cover: patch.cover as unknown as object }),
        ...(patch.settings !== undefined && { settings: patch.settings as unknown as object }),
        ...(patch.disabledBlockIds !== undefined && {
          disabledBlockIds: patch.disabledBlockIds as unknown as object,
        }),
        ...(patch.overlays !== undefined && { overlays: patch.overlays as unknown as object }),
        ...(patch.aiSnapshot !== undefined && { aiSnapshot: patch.aiSnapshot as unknown as object }),
        ...(patch.status !== undefined && { status: patch.status }),
      },
    });
    return toDeck(row);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.prisma.deck.delete({ where: { id } });
  }

  /** 署名是人的属性不是稿子的属性：新稿子沿用最近一份稿子里填过的 */
  private async lastByline(userId: string): Promise<string> {
    const recent = await this.prisma.deck.findMany({
      where: { article: { userId } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { settings: true },
    });
    for (const row of recent) {
      const byline = upgradeSettings(row.settings).byline.trim();
      if (byline) return byline;
    }
    return '';
  }
}

export interface LibraryRow {
  articleId: string;
  title: string;
  chars: number;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
  deck: {
    id: string;
    status: DeckStatus;
    blockCount: number;
    cover: CoverSpec;
    settings: DeckSettings;
    overlays: PageOverlay[];
  } | null;
  coverImages: SourceImage[];
}

type DeckRow = {
  id: string;
  articleId: string;
  contentType: string;
  blocks: unknown;
  cover: unknown;
  settings: unknown;
  disabledBlockIds: unknown;
  overlays?: unknown;
  aiSnapshot?: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function toDeck(row: DeckRow): Deck {
  const settings = upgradeSettings(row.settings);
  return {
    id: row.id,
    articleId: row.articleId,
    contentType: row.contentType as ContentType,
    blocks: upgradeBlocks(row.blocks),
    cover: upgradeCover(row.cover, settings.themeId),
    settings,
    disabledBlockIds: row.disabledBlockIds as string[],
    overlays: upgradeOverlays(row.overlays),
    aiSnapshot: upgradeAiSnapshot(row.aiSnapshot),
    status: row.status as DeckStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
