import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
  StoreResult,
} from '@castmill/cache';
import { storage } from '../native';
import { simpleHash } from './utils';

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
    return storage.mkdir({ path: CACHE_PATH });
  }

  async info(): Promise<StorageInfo> {
    try {
      const { files } = await storage.listFiles({ path: CACHE_PATH });
      const used = files.reduce((acc, file) => acc + (file.size ?? 0), 0);
      const total = (await storage.getStorageInfo()).free + used * 0.5;
      return { used, total };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw error;
    }
  }

  async listFiles(): Promise<StorageItem[]> {
    const { files } = await storage.listFiles({ path: CACHE_PATH });

    return files
      .filter(({ name }) => name)
      .map((file) => ({
        url: join(CACHE_PATH, file.name ?? ''),
        size: file.size ?? 0,
      }));
  }

  async storeFile(url: string, data?: any): Promise<StoreFileReturnValue> {
    try {
      const filename = await getFileName(url);

      const filePath = join(CACHE_PATH, filename);
      const tempPath = filePath + '.tmp';

      try {
        if (data) {
          await storage.writeFile({ path: tempPath, data });
        } else {
          await storage.downloadFile({
            action: 'start',
            destination: tempPath,
            source: url,
          });
        }

        // Atomically rename the file to its final name
        await storage.moveFile({ oldPath: tempPath, newPath: filePath });
      } catch (error) {
        console.error('Failed to store file:', error);

        // Delete the temporary file if it exists
        await storage.removeFile({ file: tempPath });

        throw error;
      }
      const stats = await storage.statFile({ path: filePath });
      return {
        result: { code: StoreResult.Success },
        item: {
          url: filePath,
          size: stats.size,
        },
      };
    } catch (error: any) {
      console.error('Failed to store file:', error);
      const errMsg = error?.message ?? 'Unknown Error';
      return {
        result: { code: StoreResult.Failure, errMsg },
      };
    }
  }

  /*
   * Retrieve a file from the storage. Returns the file path if the file exists,
   */
  async retrieveFile(url: string): Promise<string | void> {
    try {
      const filePath = `${CACHE_PATH}/${await getFileName(url)}`;
      await storage.statFile({ path: filePath }); // Check if file exists
      return filePath;
    } catch (error) {
      console.error('Failed to retrieve file:', error);
      return undefined; // File does not exist
    }
  }

  /*
   * Delete a file from the storage
   */
  async deleteFile(url: string): Promise<void> {
    return storage.removeFile({
      file: `${CACHE_PATH}/${url}`,
      recursive: true,
    });
  }

  /*
   * Delete all files from the storage
   */
  async deleteAllFiles(): Promise<void> {
    return storage.removeFile({
      file: CACHE_PATH,
      recursive: true,
    });
  }

  async close(): Promise<void> {
    // NOOP on WebOS
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

  const hash = simpleHash(pathName);
  // if extension is present, append it to the hash otherwise, just return the hash
  return extension ? `${hash}.${extension}` : hash;
}
