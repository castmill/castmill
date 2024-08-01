/**
 * Castmill Cache.
 * 
 * This is a cache that is necessary for playing any content on a player. The cache is based on indexedDB +
 * an integration layer that is platform specific.
 *
 * Scenario 1: We request a certain item from the cache. However the item is not there.
 * So we must start caching it, which could take a lot of time. So the caller may say, ok the item
 * is not available now, and we do not want to wait for it to be cached.

 * Scenario 2: The cache is not large enough to cache all the items that are needed for playing all the
 * content. In this case we need to do the best possible avoinding continuos downloads of the same content.
 * The user must understand that if there is not space for the content, the player will not be able to show
 * all the content. It may be possible in the future to support for "streaming", not cacheable content, but
 * this is a separate case from the general case.
 */
import { Dexie } from 'dexie';
import {
  StorageIntegration,
  StoreResult,
  StoreError,
  StorageItem,
  StoreOptions,
} from './storage.integration';

/*
if ("storage" in navigator && "estimate" in navigator.storage) {
  navigator.storage.estimate().then(function (estimate) {
    console.log(estimate);
  });
}
*/

export enum ItemType {
  Code = 'code',
  Data = 'data',
  Media = 'media',
}

interface ItemMetadata {
  cachedUrl: string;
  url: string;
  timestamp: number;
  size: number;
  accessed: number;
  type: ItemType;
  mimeType: string;
}

export type SetItemCacheOptions = StoreOptions & { force: boolean };

export class Cache extends Dexie {
  items!: Dexie.Table<ItemMetadata, string>;
  caching: { [index: string]: Promise<StorageItem | undefined> } = {};
  totalSize: number = 0;

  constructor(
    private integration: StorageIntegration,
    name: string,
    private maxItems: number,
    version = 1
  ) {
    super(name);

    this.version(version).stores({
      items: 'url, timestamp, type',
    });
  }

  async init() {
    await this.integration.init();
    await this.syncCache();
  }

  private async syncCache() {
    // Remove items from integration that are not cached anymore
    const files = await this.integration.listFiles();
    for (const file of files) {
      const item = await this.items.get({ url: file.url });
      if (!item) {
        await this.integration.deleteFile(file.url);
      }
    }

    // Iterate existing items and make sure they are up-to-date
    /*
    for (const itemType of Object.values(ItemType)) {
      const items = await this.list(itemType);
      for (const item of items) {
        await this.set(item.url, item.type, item.mimeType, { force: true });
      }
    }
    */
  }

  /**
   * List items of a given type. Supports pagination.
   * @param type
   *
   * @param offset
   * @param limit
   * @returns
   */
  async list(type: ItemType, offset: number = 0, limit: number = 10) {
    // List all the items of a given type
    const items = await this.items
      .where('type')
      .equals(type)
      .offset(offset)
      .limit(limit)
      .toArray();

    return items;
  }

  /**
   * Count the items of a given type.
   *
   */
  async count(type: ItemType) {
    return this.items.where('type').equals(type).count();
  }

  /**
   * Tries to get a cached item.
   * Note that a item that is in the process of being cached will not be returned.
   *
   * @param url
   * @returns
   */
  async get(url: string) {
    if (!this.caching[url]) {
      const item = await this.items.get({ url });
      if (item) {
        item.accessed += 1;
        await this.items.update(item.url!, {
          timestamp: Date.now(),
          accessed: item.accessed,
        });
      }
      return item;
    }
    return null;
  }

  async hasUrl(url: string) {
    // Check if we are caching the item.
    if (!!this.caching[url]) {
      return true;
    }

    // Check if the item  is not  already cached
    const item = await this.items.get({ url });
    if (item) {
      return true;
    }

    return false;
  }

  async set(
    url: string,
    type: ItemType,
    mimeType: string,
    opts: SetItemCacheOptions = { force: false }
  ) {
    // Check if we are already caching the item.
    if (!!this.caching[url]) {
      return;
    }

    // Check if the item  is not  already cached
    const item = await this.items.get({ url });
    if (item) {
      if (!opts.force) {
        return;
      }
      await this.del(url);
    }

    // Check if we need to delete old items (based on max amount)
    if (this.maxItems) {
      const count = await this.items.count();
      if (count >= this.maxItems) {
        const items = await this.items
          .orderBy('timestamp')
          .limit(count - this.maxItems + 1)
          .toArray();
        for (const item of items) {
          await this.items.delete(item.url!);
        }
      }
    }

    const storeFilePromise = this.storeFile(url, type, mimeType, opts);
    this.caching[url] = storeFilePromise;

    return storeFilePromise
      .catch(async (err) => {
        // TODO: we should use the device logger instead of console.error
        console.error('Error caching file', url, err);

        try {
          const item = await this.items.get({ url });
          if (item) {
            await this.del(url);
          }
        } catch (err) {
          console.error('Error deleting item', url, err);
        }

        throw err;
      })
      .finally(() => {
        delete this.caching[url];
      });
  }

  private async storeFile(
    url: string,
    type: ItemType,
    mimeType: string,
    opts?: StoreOptions
  ): Promise<ItemMetadata | undefined> {
    try {
      const { result, item: storageItem } = await this.integration.storeFile(
        url,
        opts
      );
      switch (result.code) {
        case StoreResult.Success:
          if (storageItem) {
            const { url: cachedUrl, size } = storageItem;
            if (!cachedUrl) {
              throw new Error('Cached url is null');
            }
            this.totalSize += size;

            const item: ItemMetadata = {
              timestamp: Date.now(),
              size,
              accessed: 0,
              type,
              url,
              cachedUrl,
              mimeType,
            };
            await this.items.add(item);
            return item;
          }
          throw new Error(
            'Cache: Storage is missing item despite signaling success'
          );
        case StoreResult.Failure:
          switch (result.error) {
            case StoreError.NotEnoughSpace:
              // TODO: we probably need a counter here to avoid infinite loops
              if (result.errMsg) {
                const requiredSpace = parseInt(result.errMsg);
                await this.freeSpace(requiredSpace);
                return this.storeFile(url, type, mimeType, opts);
              } else {
                throw new Error('Not enough space, and no error message');
              }
            case StoreError.NotFound:
              throw new Error('File not found');
            default:
              throw new Error(
                `Unhandled error ${result.error} ${result.errMsg}`
              );
          }
        default:
          throw new Error(`Unhandled result code ${result.code}`);
      }
    } catch (err) {
      console.error('Error caching file', url, err);
      throw err as Error;
    }
  }

  /**
   *
   * @param size The required extra size needed to make room for the new key.
   */
  private async freeSpace(size: number) {
    const count = await this.items.count();

    if (size <= 0) {
      return;
    }

    // TODO: it is possible to keep a totalSize counter and
    // keep it updated so that this slow getTotalSize is not needed more than
    // when initializing the cache.
    const totalSize = await this.getTotalSize();

    if (totalSize < size) {
      throw new Error('Not enough space to free');
    }

    // Iterate in chunks of 10, and free as much as needed
    const chunkSize = 10;
    let freedSpace = 0;
    const numChunks = Math.ceil(count / chunkSize);
    for (let chunk = 0; chunk < numChunks; chunk++) {
      const items = await this.items
        .orderBy('timestamp')
        .offset(chunk * chunkSize)
        .limit(chunkSize)
        .toArray();
      for (const item of items) {
        freedSpace += item.size;
        await this.del(item.url!);
        if (freedSpace >= size) {
          return;
        }
      }
    }

    throw new Error('Could not free enough space');
  }

  private async getTotalSize() {
    let totalSize = 0;
    const count = await this.items.count();

    // aggregate in chunks of 100 items
    const chunkSize = 100;
    const numChunks = Math.ceil(count / chunkSize);
    for (let chunk = 0; chunk < numChunks; chunk++) {
      const items = await this.items
        .orderBy('timestamp')
        .offset(chunk * chunkSize)
        .limit(chunkSize)
        .toArray();
      for (const item of items) {
        totalSize += item.size;
      }
    }
    return totalSize;
  }

  async del(key: string) {
    await this.integration.deleteFile(key);
    return this.items.delete(key);
  }

  /**
   * Clean all the cached items one by one.
   *
   * @param mimeType
   */
  async clean(mimeType?: string) {
    const items = await this.items.toArray();
    for (const item of items) {
      await this.del(item.url!);
    }
  }

  /**
   * Helper to clean the whole indexedDB.
   */
  private cleanIndexedDB() {
    // List all databases
    window.indexedDB.databases().then((dbList) => {
      dbList.forEach((dbInfo) => {
        // Delete each database
        if (dbInfo.name) {
          const deleteRequest = window.indexedDB.deleteDatabase(dbInfo.name);

          deleteRequest.onerror = () => {
            console.error(`Failed to delete database ${dbInfo.name}`);
          };

          deleteRequest.onsuccess = () => {
            console.log(`Successfully deleted database ${dbInfo.name}`);
          };
        }
      });
    });
  }
}
