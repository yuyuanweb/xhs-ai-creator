export interface StoredFile {
  key: string;
  url: string;
}

/**
 * 文件存储的抽象。当前实现落本地卷，
 * 换对象存储时只需要再写一个实现并在模块里替换 provider。
 */
export abstract class StorageService {
  abstract save(key: string, data: Buffer): Promise<StoredFile>;
  abstract read(key: string): Promise<Buffer>;
  abstract exists(key: string): Promise<boolean>;
  abstract urlOf(key: string): string;
  /** urlOf 的反查。不是本存储发出的地址时返回 null */
  abstract keyOf(url: string): string | null;
}
