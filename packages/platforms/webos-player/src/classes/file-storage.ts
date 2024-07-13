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
    //TODO implement
    console.log('Initializing file storage');
  }

  async info(): Promise<StorageInfo> {
    //TODO implement
    throw new Error('Method not implemented.');
  }

  async listFiles(): Promise<StorageItem[]> {
    //TODO implement
    throw new Error('Method not implemented.');
  }

  async storeFile(url: string, data?: any): Promise<StoreFileReturnValue> {
    //TODO implement
    throw new Error('Method not implemented.');
  }

  async retrieveFile(url: string): Promise<string | void> {
    //TODO implement
    throw new Error('Method not implemented.');
  }

  async deleteFile(url: string): Promise<void> {
    //TODO implement
    throw new Error('Method not implemented.');
  }

  async deleteAllFiles(): Promise<void> {
    //TODO implement
    throw new Error('Method not implemented.');
  }

  async close(): Promise<void> {
    //TODO implement?
    console.log('Closing storage resources, if any');
  }
}
