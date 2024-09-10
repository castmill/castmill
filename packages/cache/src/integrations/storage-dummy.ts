/**
 * A dummy storage integration when no storage is needed or available.
 *
 */
import {
  StorageIntegration,
  StoreFileReturnValue,
  StoreOptions,
} from '../storage.integration';

export class StorageDummy implements StorageIntegration {
  prefix = 'castmill:storage';
  cacheName: string;
  private cache: {
    [url: string]: {
      url: string;
      size: number;
    };
  } = {};

  constructor(private name: string) {
    this.cacheName = `${this.prefix}:${this.name}`;
  }

  /**
   * Perform any initialization required by the cache.
   */
  async init() {}

  /**
   *
   */
  async info() {
    return {
      used: 0,
      total: 0,
    };
  }

  /**
   * List the files of the cache, if possible support pagination.
   */
  async listFiles() {
    return Object.values(this.cache);
  }

  /**
   * Store a file for a given url. The file must be downloaded and
   * stored by the integration in the most efficient way for the
   * given platform.
   *
   * @param url
   */
  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    const item = {
      url,
      size: 0,
    };
    const file: StoreFileReturnValue = {
      item,
      result: {
        code: 'SUCCESS',
      },
    };

    this.cache[url] = item;
    return file;
  }

  /**
   * Retrieves a uri like string representing a file in the storage.
   *
   * NOTE:  Maybe not needed since we are storing the uri in indexedDB.
   * @param key
   */
  async retrieveFile(key: string): Promise<string | void> {}

  /**
   * Deletes a file from the storage.
   *
   * @param key
   *
   */
  async deleteFile(url: string) {
    delete this.cache[url];
  }

  /**
   * Deletes all the files from the storage
   */
  async deleteAllFiles() {
    this.cache = {};
  }

  async close() {}
}
