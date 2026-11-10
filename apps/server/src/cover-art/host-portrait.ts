import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageInput } from './gemini-image.service';

/** 编译后在 dist/cover-art，照片放在 apps/server/assets，两处相对位置一样 */
const PORTRAIT_PATH = path.resolve(__dirname, '../../assets/cover-host.png');

let cached: Promise<ImageInput | null> | undefined;

/**
 * 固定出镜人。封面需要人物时用这张脸，不让模型另找一个。
 * 照片属于个人信息，仓库里不带，把自己的照片放到 apps/server/assets/cover-host.png 就会启用；没有就返回 null
 */
export function loadHostPortrait(): Promise<ImageInput | null> {
  cached ??= readFile(PORTRAIT_PATH)
    .then((data): ImageInput => ({ data, mime: 'image/png' }))
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return null;
      cached = undefined;
      throw err;
    });
  return cached;
}
