/**
 * File Integration Interface.
 *
 * This interface is used to integrate the cache with other systems.
 * Implement this interface for the target hardware and use the implementation
 * when instantiating the cache.
 *
 */

export interface StorageItem {
  url: string;
  size: number; // Size in bytes of the item.
  headers?: Record<string, string>; // Optional headers required to get the stored item.
}

export interface StorageInfo {
  used: number; // Size in bytes of the used storage.
  total: number; // Size in bytes of the total storage.
}

export interface StoreOptions {
  headers?: Record<string, string>;
  data?: any;
}

export enum StoreResult {
  Success,
  Failure,
}

export enum StoreError {
  None,
  Unknown,
  NotFound,
  NotAllowed,
  NotSupported,
  TooLarge,
  NotEnoughSpace,
}

export interface StoreFileReturnValue {
  result: { code: StoreResult; error?: StoreError; errMsg?: string };
  item?: StorageItem;
}

export interface StorageIntegration {
  /**
   * Perform any initialization required by the cache.
   */
  init(): Promise<void>;

  /**
   * Returns the information about the storage.
   */
  info(): Promise<StorageInfo>;

  /**
   * List the files of the cache, if possible support pagination.
   */
  listFiles(): Promise<StorageItem[]>;

  /**
   * Store a file on a given key. The file must be downloaded and
   * stored by the integration in the most efficient way for the
   * given platform.
   *
   * @param url
   * @param opts Options such as request headers, and/or data.
   */
  storeFile(url: string, opts?: StoreOptions): Promise<StoreFileReturnValue>;

  /**
   * Retrieves a uri like string representing a file in the storage.
   *
   * NOTE:  Maybe not needed since we are storing the uri in indexedDB.
   * @param url
   */
  retrieveFile(url: string): Promise<string | void>;

  /**
   * Deletes a file from the storage.
   *
   * @param url
   *
   */
  deleteFile(url: string): Promise<void>;

  /**
   * Deletes all the files from the storage
   */
  deleteAllFiles(): Promise<void>;

  /**
   * Close the storage.
   *
   * Frees any listeners and/or resources used by the storage.
   */
  close(): Promise<void>;
}
