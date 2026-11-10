import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PROMPTS } from './default-prompts';

@Injectable()
export class PromptsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 出厂基线跟着代码走：没被人工改过的提示词每次启动都刷新成最新版，
   * 否则改了代码里的基线、线上却一直跑着第一次写入数据库的那版，排查起来全是幻觉。
   */
  async onModuleInit() {
    for (const seed of DEFAULT_PROMPTS) {
      const row = await this.prisma.prompt.findUnique({ where: { key: seed.key } });
      if (!row) {
        await this.prisma.prompt.create({ data: seed });
        continue;
      }
      if (row.custom) continue;
      await this.prisma.prompt.update({
        where: { key: seed.key },
        data: { title: seed.title, content: seed.content },
      });
    }
  }

  list() {
    return this.prisma.prompt.findMany({ orderBy: { key: 'asc' } });
  }

  async get(key: string): Promise<string> {
    const row = await this.prisma.prompt.findUnique({ where: { key } });
    if (row) return row.content;
    return DEFAULT_PROMPTS.find((p) => p.key === key)?.content ?? '';
  }

  async update(key: string, content: string) {
    const exists = await this.prisma.prompt.findUnique({ where: { key } });
    if (!exists) throw new NotFoundException('提示词不存在');
    return this.prisma.prompt.update({ where: { key }, data: { content, custom: true } });
  }

  async reset(key: string) {
    const seed = DEFAULT_PROMPTS.find((p) => p.key === key);
    if (!seed) throw new NotFoundException('没有这条提示词的出厂基线');
    return this.prisma.prompt.update({ where: { key }, data: { content: seed.content, custom: false } });
  }
}
