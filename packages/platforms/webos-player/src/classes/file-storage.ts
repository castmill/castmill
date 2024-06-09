import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
} from '@castmill/cache';

export class FileStorage implements StorageIntegration {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    console.log('Initializing file storage');
  }

  async info(): Promise<StorageInfo> {
    throw new Error('Method not implemented.');
  }

  async listFiles(): Promise<StorageItem[]> {
    throw new Error('Method not implemented.');
  }

  async storeFile(url: string, data?: any): Promise<StoreFileReturnValue> {
    throw new Error('Method not implemented.');
  }

  async retrieveFile(url: string): Promise<string | void> {
    throw new Error('Method not implemented.');
  }

  async deleteFile(url: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async deleteAllFiles(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async close(): Promise<void> {
    //noop
    console.log('Closing storage resources, if any');
  }
}
