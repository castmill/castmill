import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreOptions,
  StoreFileReturnValue,
} from '@castmill/cache';
import { simpleHash } from '../utils';

const FALLBACK_MAX_DISK_SPACE = 10e9; // 10 GB
const DIR = Directory.Documents;

function join(...parts: string[]): string {
  return parts.join('/');
}

export class AndroidStorage implements StorageIntegration {
  storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    try {
      const storageDirStats = await Filesystem.stat({
        path: this.storagePath,
        directory: DIR,
      });
      return;
    } catch (error) {
      return Filesystem.mkdir({
        path: this.storagePath,
        directory: DIR,
      });
    }
  }

  async info(): Promise<StorageInfo> {
    try {
      const { files } = await Filesystem.readdir({
        path: this.storagePath,
        directory: DIR,
      });
      let used = 0;
      for (const file of files) {
        used += file.size;
      }

      const { diskFree } = await Device.getInfo();
      // Use 50% of the free disk space as the total space
      const total = diskFree
        ? (diskFree + used) * 0.5
        : FALLBACK_MAX_DISK_SPACE;
      return { used, total };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw error;
    }
  }

  async listFiles(): Promise<StorageItem[]> {
    try {
      const { files } = await Filesystem.readdir({
        path: this.storagePath,
        directory: DIR,
      });
      return Promise.all(
        files
          .filter(({ name }) => !name.endsWith('.tmp')) // Exclude temporary files
          .map(async ({ name, size }) => {
            const filePath = join(this.storagePath, name);

            const localUrl = await this.getLocalUrl(filePath);
            return {
              url: localUrl,
              size,
            };
          })
      );
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  async downloadFile(filePath: string, url: string, opts?: StoreOptions) {
    await this.deleteFileIfExists(filePath);
    return await Filesystem.downloadFile({
      path: filePath,
      url: url.replace('localhost', '10.0.2.2'), // Android emulator localhost
      headers: opts?.headers,
      directory: DIR,
      recursive: true,
    });
  }

  async rename(oldPath: string, newPath: string) {
    await this.deleteFileIfExists(newPath);
    return await Filesystem.rename({
      from: oldPath,
      to: newPath,
      directory: DIR,
    });
  }

  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    try {
      const filename = this.getFileName(url);

      const filePath = join(this.storagePath, filename);
      const tempPath = this.getTempPath(filePath);

      try {
        await this.downloadFile(tempPath, url, opts);

        // Atomically rename the file to its final name
        await this.rename(tempPath, filePath);
      } catch (error) {
        console.error('Failed to store file:', error);

        // Delete the temporary file if it exists
        await Filesystem.deleteFile({
          path: tempPath,
          directory: DIR,
        });

        throw error;
      }
      const stats = await Filesystem.stat({
        path: filePath,
        directory: DIR,
      });

      const localUrl = await this.getLocalUrl(filePath);

      return {
        result: { code: 'SUCCESS' },
        item: {
          url: localUrl,
          size: stats.size,
        },
      };
    } catch (error: any) {
      console.error('Failed to store file:', error);
      const errMsg = error?.message ?? 'Unknown Error';
      return {
        result: { code: 'FAILURE', errMsg },
      };
    }
  }

  async retrieveFile(url: string): Promise<string | void> {
    try {
      const filePath = join(this.storagePath, this.getFileName(url));
      await Filesystem.stat({ path: filePath, directory: DIR }); // Check if file exists
      return filePath;
    } catch (error) {
      return undefined; // File does not exist
    }
  }

  async deleteFile(url: string): Promise<void> {
    const filePath = join(this.storagePath, this.getFileName(url));
    await this.deleteFileIfExists(filePath);
  }

  async deleteFileIfExists(filePath: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: filePath, directory: DIR });
    } catch (error: any) {
      if (error?.message === 'File does not exist') {
        // File does not exist, nothing to do
        return;
      }

      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async deleteAllFiles(): Promise<void> {
    try {
      const { files } = await Filesystem.readdir({
        path: this.storagePath,
        directory: DIR,
      });
      await Promise.all(
        files.map(({ name }) => {
          return Filesystem.deleteFile({
            path: join(this.storagePath, name),
            directory: DIR,
          });
        })
      );
    } catch (error) {
      console.error('Failed to delete all files:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    //noop
  }

  /*
   * Generate a unique file name based on the URL. Keep the extension if present.
   * @param {string} url - The URL of the file
   * @returns {string} - The unique file name
   */
  private getFileName(url: string): string {
    const pathName = new URL(url).pathname;
    // Get the extension of the file using regex. up to 4 characters after the last dot
    const [file, extension] = pathName.split('.');

    const hash = simpleHash(pathName);

    // if extension is present, append it to the hash otherwise, just return the hash
    return extension ? `${hash}.${extension}` : hash;
  }

  private getTempPath(path: string): string {
    return `${path}-${Date.now()}.tmp`;
  }

  /**
   * Get the local URL of a file.
   * Example:
   *  getLocalUrl('test/file1.txt') =>
   *    'https://localhost/_capacitor_file_/test/file1.txt'
   */
  private async getLocalUrl(filePath: string): Promise<string> {
    const { uri } = await Filesystem.getUri({
      path: filePath,
      directory: DIR,
    });
    return Capacitor.convertFileSrc(uri);
  }
}
