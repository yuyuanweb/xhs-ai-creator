import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { StorageService, StoredFile } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly root: string;
  private readonly prefix: string;

  constructor(config: ConfigService) {
    super();
    this.root = join(process.cwd(), config.get<string>('STORAGE_DIR', './storage'));
    this.prefix = config.get<string>('STORAGE_PUBLIC_PREFIX', '/static');
  }

  async save(key: string, data: Buffer): Promise<StoredFile> {
    const file = join(this.root, key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    return { key, url: this.urlOf(key) };
  }

  read(key: string): Promise<Buffer> {
    return readFile(join(this.root, key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(join(this.root, key));
      return true;
    } catch {
      return false;
    }
  }

  urlOf(key: string): string {
    return `${this.prefix}/${key}`;
  }

  keyOf(url: string): string | null {
    const head = `${this.prefix}/`;
    if (!url.startsWith(head)) return null;
    const key = url.slice(head.length);
    return key && !key.split('/').includes('..') ? key : null;
  }
}
