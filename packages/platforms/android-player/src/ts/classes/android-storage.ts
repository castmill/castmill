import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';

import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
} from '@castmill/cache';
import { simpleHash } from '../utils';

const FALLBACK_MAX_DISK_SPACE = 10e9; // 10 GB
const DIR = Directory.Documents;

function join(...parts: string[]): string {
  return parts.join('/');
}

async function digestText(message: string) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Convert bytes to hex string
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
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
      const total = diskFree ? diskFree + used * 0.5 : FALLBACK_MAX_DISK_SPACE;
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
          .map(({ name, size }) => {
            const filePath = join(this.storagePath, name);
            return {
              url: filePath,
              size,
            };
          })
      );
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  async deleteFileIfExists(filePath: string): Promise<void> {
    console.log('Deleting if exists', filePath);
    try {
      await Filesystem.deleteFile({ path: filePath, directory: DIR });
    } catch (error) {
      // File does not exist, nothing to do
    }
  }

  async writeFile(filePath: string, data: any) {
    await this.deleteFileIfExists(filePath);
    return await Filesystem.writeFile({
      path: filePath,
      data: data,
      directory: DIR,
      recursive: true,
    });
  }

  async downloadFile(filePath: string, url: string) {
    console.log('Downloading', url, 'to', filePath);
    await this.deleteFileIfExists(filePath);
    return await Filesystem.downloadFile({
      path: filePath,
      url: url,
      directory: DIR,
      recursive: true,
    });
  }

  async rename(oldPath: string, newPath: string) {
    console.log('Renaming', oldPath, newPath);
    await this.deleteFileIfExists(newPath);
    return await Filesystem.rename({
      from: oldPath,
      to: newPath,
      directory: DIR,
    });
  }

  async storeFile(url: string, data?: any): Promise<StoreFileReturnValue> {
    try {
      const filename = await this.getFileName(url);

      const filePath = join(this.storagePath, filename);
      const tempPath = this.getTempPath(filePath);

      try {
        if (data) {
          await this.writeFile(tempPath, data);
        } else {
          await this.downloadFile(tempPath, url);
        }

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

      const { uri } = await Filesystem.getUri({
        path: filePath,
        directory: DIR,
      });
      const localUrl = Capacitor.convertFileSrc(uri);
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

  /*
   * Generate a unique file name based on the URL. Keep the extension if present.
   * @param {string} url - The URL of the file
   * @returns {string} - The unique file name
   */
  async getFileName(url: string): Promise<string> {
    const pathName = new URL(url).pathname;
    const extension = pathName.split('.').pop();

    const hash = await digestText(pathName);
    // if extension is present, append it to the hash otherwise, just return the hash
    return extension ? `${hash}.${extension}` : hash;
  }

  getTempPath(path: string): string {
    return `${path}-${Date.now()}.tmp`;
  }

  async retrieveFile(url: string): Promise<string | void> {
    try {
      const filePath = join(this.storagePath, await this.getFileName(url));
      await Filesystem.stat({ path: filePath, directory: DIR }); // Check if file exists
      return filePath;
    } catch (error) {
      console.log('Failed to retrieve file:', error);
      return undefined; // File does not exist
    }
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const filePath = join(this.storagePath, await this.getFileName(url));
      await Filesystem.deleteFile({ path: filePath, directory: DIR });
    } catch (error) {
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
    console.log('Closing storage resources, if any');
  }
}
