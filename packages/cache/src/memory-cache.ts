import { ItemMetadata, ItemType, SetItemCacheOptions } from './cache';
import type { CacheBackend } from './cache-backend';
import type {
  StorageIntegration,
  StoreFileReturnValue,
} from './storage.integration';

export class MemoryCache implements CacheBackend {
  private readonly items = new Map<string, ItemMetadata>();
  private readonly caching = new Map<
    string,
    Promise<ItemMetadata | undefined>
  >();
  private initialized?: Promise<void>;

  constructor(
    private readonly integration: StorageIntegration,
    private readonly maxItems = 1000
  ) {}

  init(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.initialize().catch((error: unknown) => {
        this.initialized = undefined;
        throw error;
      });
    }
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    await this.integration.init();
    const files = await this.integration.listFiles();
    for (const file of files) {
      if (file.sourceUrl) {
        this.items.set(file.sourceUrl, {
          url: file.sourceUrl,
          cachedUrl: file.url,
          size: file.size,
          type: ItemType.Media,
          mimeType: 'media/*',
          timestamp: Date.now(),
          accessed: 0,
        });
      }
    }
  }

  async list(type: ItemType, offset = 0, limit = 10): Promise<ItemMetadata[]> {
    return Array.from(this.items.values())
      .filter((item) => item.type === type)
      .slice(offset, offset + limit);
  }

  async count(type: ItemType): Promise<number> {
    return (await this.list(type, 0, this.items.size)).length;
  }

  async get(url: string): Promise<ItemMetadata | null | undefined> {
    if (this.caching.has(url)) return null;
    const item = this.items.get(url);
    if (item) {
      item.timestamp = Date.now();
      item.accessed++;
    }
    return item;
  }

  async hasUrl(url: string): Promise<boolean> {
    return this.caching.has(url) || this.items.has(url);
  }

  async set(
    url: string,
    type: ItemType,
    mimeType: string,
    opts: SetItemCacheOptions = { force: false }
  ): Promise<ItemMetadata | undefined> {
    const pending = this.caching.get(url);
    if (pending) return pending;
    const previous = this.items.get(url);
    if (previous && !opts.force) return;

    const work = this.storeFile(url, type, mimeType, opts, previous);
    this.caching.set(url, work);
    try {
      return await work;
    } finally {
      this.caching.delete(url);
    }
  }

  private async storeFile(
    url: string,
    type: ItemType,
    mimeType: string,
    opts: SetItemCacheOptions,
    previous?: ItemMetadata
  ): Promise<ItemMetadata> {
    const { result, item: file } = await this.storeWithCapacityRetry(
      url,
      type,
      opts
    );
    if (result.code !== 'SUCCESS' || !file?.url) {
      throw new Error(
        `Unable to cache resource: ${result.error ?? result.code}`
      );
    }
    const item: ItemMetadata = {
      url,
      cachedUrl: file.url,
      size: file.size,
      type,
      mimeType,
      timestamp: Date.now(),
      accessed: 0,
    };
    this.items.set(url, item);
    if (previous && previous.cachedUrl !== item.cachedUrl) {
      try {
        await this.integration.deleteFile(previous.cachedUrl);
      } catch (error) {
        console.error('MemoryCache: Failed to remove replaced file', error);
      }
    }
    while (this.maxItems && this.items.size > this.maxItems) {
      const oldest = Array.from(this.items.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      )[0];
      if (!oldest) throw new Error('MemoryCache: No item to evict');
      await this.del(oldest.url);
    }
    return item;
  }

  private async storeWithCapacityRetry(
    url: string,
    type: ItemType,
    opts: SetItemCacheOptions
  ): Promise<StoreFileReturnValue> {
    // Keep a forced refresh's previous file as a fallback if the new write fails.
    const candidates = Array.from(this.items.values())
      .filter((item) => item.url !== url)
      .sort((a, b) => a.timestamp - b.timestamp);
    let next = 0;
    const evictNext = async (): Promise<boolean> => {
      const candidate = candidates[next++];
      if (!candidate) return false;
      await this.del(candidate.url);
      return true;
    };

    while (true) {
      let response: StoreFileReturnValue;
      try {
        response = await this.integration.storeFile(url, { ...opts, type });
      } catch (error) {
        if (!this.isCapacityError(error) || !(await evictNext())) {
          throw error;
        }
        continue;
      }

      if (
        response.result.code !== 'FAILURE' ||
        response.result.error !== 'NOT_ENOUGH_SPACE' ||
        !(await evictNext())
      ) {
        return response;
      }
    }
  }

  private isCapacityError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const { code, name, message } = error as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
    };
    return (
      code === 'ENOSPC' ||
      name === 'QuotaExceededError' ||
      (typeof message === 'string' &&
        /^(?:CacheFull|disk full|storage full|no space left on device|ENOSPC(?::.*)?)$/i.test(
          message.trim()
        ))
    );
  }

  async del(url: string): Promise<void> {
    const item = this.items.get(url);
    if (!item) return;
    await this.integration.deleteFile(item.cachedUrl);
    this.items.delete(url);
  }

  async invalidate(url: string): Promise<void> {
    const item = this.items.get(url);
    this.items.delete(url);
    if (!item) return;
    try {
      await this.integration.deleteFile(item.cachedUrl);
    } catch (error) {
      console.error('MemoryCache: Failed to remove invalid file', url, error);
    }
  }

  async clean(): Promise<number> {
    const count = this.items.size;
    await this.integration.deleteAllFiles();
    this.items.clear();
    return count;
  }

  close(): void {
    void this.integration.close().catch((error: unknown) => {
      console.error('MemoryCache: Failed to close storage', error);
    });
  }
}
