import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
} from '@castmill/cache';
import { storage } from '../native';
import { digestText } from './utils';

const CACHE_DIR = 'castmill-cache';
const CACHE_PATH = `file://internal/${CACHE_DIR}`;

function join(...parts: string[]): string {
  return parts.join('/');
}

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

  /*
   * Retrieve a file from the storage. Returns the file path if the file exists,
   */
  async retrieveFile(url: string): Promise<string | void> {
    try {
      const filePath = `%{CACHE_PATH}/${await getFileName(url)}`;
      await storage.statFile({path: filePath}); // Check if file exists
      return filePath;
    } catch (error) {
      console.log('Failed to retrieve file:', error);
      return undefined; // File does not exist
    }
  }

  /*
   * Delete a file from the storage
   */
  async deleteFile(url: string): Promise<void> {
    return storage.removeFile({
      file: `${CACHE_PATH}/${url}`,
      recursive: true
    });
  }

  /*
   * Delete all files from the storage
   */
  async deleteAllFiles(): Promise<void> {
    return storage.removeFile({
      file: CACHE_PATH,
      recursive: true
    });
  }

  async close(): Promise<void> {
    //TODO implement?
    console.log('Closing storage resources, if any');
  }
}

/*
 * Generate a unique file name based on the URL. Keep the extension if present.
 * @param {string} url - The URL of the file
 * @returns {string} - The unique file name
 */
async function getFileName(url: string): Promise<string> {
  const pathName = new URL(url).pathname;
  const extension = pathName.split('.').pop();

  const hash = await digestText(pathName);
  // if extension is present, append it to the hash otherwise, just return the hash
  return extension ? `${hash}.${extension}` : hash;
}
