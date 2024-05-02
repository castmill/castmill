import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
} from '@castmill/cache';

// import the required functionality from contextBridge
const fsApi = window.fsApi;

export class FileStorage implements StorageIntegration {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    return fsApi.init(this.storagePath);
  }

  async info(): Promise<StorageInfo> {
    return fsApi.info(this.storagePath);
  }

  async listFiles(): Promise<StorageItem[]> {
    return fsApi.listFiles(this.storagePath);
  }

  async storeFile(url: string, data?: any): Promise<StoreFileReturnValue> {
    return fsApi.storeFile(this.storagePath, url, data);
  }

  async retrieveFile(url: string): Promise<string | void> {
    return fsApi.retrieveFile(this.storagePath, url);
  }

  async deleteFile(url: string): Promise<void> {
    return fsApi.deleteFile(this.storagePath, url);
  }

  async deleteAllFiles(): Promise<void> {
    return fsApi.deleteAllFiles(this.storagePath);
  }

  async close(): Promise<void> {
    //noop
    console.log('Closing storage resources, if any');
  }
}
