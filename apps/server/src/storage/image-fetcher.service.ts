import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import imageSize from 'image-size';
import { StorageService } from './storage.service';

export interface FetchedImage {
  url: string;
  width: number;
  height: number;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

export interface StoredImage {
  data: Buffer;
  mime: string;
}

@Injectable()
export class ImageFetcherService {
  private readonly logger = new Logger(ImageFetcherService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * 把远程配图转存到本地。
   * 公众号图片有 referer 防盗链，浏览器直接引用会拿到提示图，必须走服务端下载。
   * 转存后仍在块流里保留 origin，本地副本丢失时可凭它重新抓取。
   */
  async fetch(origin: string): Promise<FetchedImage | null> {
    try {
      const res = await fetch(origin, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        this.logger.warn(`抓取配图失败 ${res.status}：${origin}`);
        return null;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      const ext = EXT_BY_MIME[res.headers.get('content-type')?.split(';')[0]?.trim() ?? ''] ?? 'jpg';
      const key = `images/${createHash('sha1').update(origin).digest('hex')}.${ext}`;

      const dim = imageSize(buf);
      if (!dim.width || !dim.height) {
        this.logger.warn(`无法识别图片尺寸：${origin}`);
        return null;
      }

      if (!(await this.storage.exists(key))) await this.storage.save(key, buf);
      return { url: this.storage.urlOf(key), width: dim.width, height: dim.height };
    } catch (err) {
      this.logger.warn(`抓取配图异常：${origin} — ${(err as Error).message}`);
      return null;
    }
  }

  async saveUpload(buf: Buffer, mime: string): Promise<FetchedImage> {
    const ext = EXT_BY_MIME[mime] ?? 'jpg';
    if (!EXT_BY_MIME[mime]) throw new BadRequestException('只支持 PNG、JPEG、GIF、WebP、AVIF');
    const dim = imageSize(buf);
    if (!dim.width || !dim.height) throw new BadRequestException('无法识别图片尺寸');
    const key = `images/${createHash('sha1').update(buf).digest('hex')}.${ext}`;
    if (!(await this.storage.exists(key))) await this.storage.save(key, buf);
    return { url: this.storage.urlOf(key), width: dim.width, height: dim.height };
  }

  /** 读回已转存图片的字节，给需要把图交给模型看的场景用 */
  async readStored(url: string): Promise<StoredImage> {
    const key = this.storage.keyOf(url);
    if (!key || !(await this.storage.exists(key))) throw new BadRequestException('这张图的本地副本不存在');
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return { data: await this.storage.read(key), mime: MIME_BY_EXT[ext] ?? 'image/jpeg' };
  }
}
