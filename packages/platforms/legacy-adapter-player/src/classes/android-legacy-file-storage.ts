/**
 * This storage integration uses the API provided by the legacy Android
 * Castmill player app. It stores files in the device's internal storage but
 * since the api is very limited, it assumes that there is room for exactly
 * 1GB of files and that each file is 1MB in size. This is unfortunately the
 * best we can do with this API.
 */

import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
  StoreOptions,
} from '@castmill/cache';
import { simpleHash } from './utils';
import {
  getItem,
  setItem,
  downloadFile,
  deleteFile,
  deletePath,
} from '../android-legacy-api';

interface FileData {
  url: string;
  size: number;
}

const TOTAL_STORAGE = 1e9; // 1GB

export class AndroidLegacyFileStorage implements StorageIntegration {
  private storagePath: string;
  private fileMap = new Map<string, FileData>();
  private fileRevision = Date.now();

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  private async loadFileMap(): Promise<Map<string, FileData>> {
    const fileMap = await getItem('FILE_MAP');
    if (fileMap) {
      try {
        return new Map(JSON.parse(fileMap));
      } catch (err) {
        console.error('Error parsing file map', err);
      }
    }

    return new Map<string, FileData>();
  }

  private async saveFileMap(): Promise<void> {
    await setItem(
      'FILE_MAP',
      JSON.stringify(Array.from(this.fileMap.entries()))
    );
  }

  async init(): Promise<void> {
    this.fileMap = await this.loadFileMap();
  }

  async info(): Promise<StorageInfo> {
    const used = (await this.listFiles()).reduce(
      (acc, file) => acc + file.size,
      0
    );

    return {
      total: TOTAL_STORAGE,
      used,
    };
  }

  async listFiles(): Promise<StorageItem[]> {
    return Array.from(this.fileMap.values()).map((file) => ({
      url: file.url,
      size: file.size,
    }));
  }

  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    const mappedUrl = this.mapLocalhostUrl(url);

    const fileName = this.getFileName(mappedUrl, this.fileRevision++);
    const localPath = this.getLocalUrl(fileName);

    // Android legacy player does not support headers in the downloadFile API
    // so we need to pass the Authorization header as a query parameter
    const auth = opts?.headers?.Authorization;
    const urlWithParams = auth
      ? `${mappedUrl}?auth=${encodeURIComponent(auth)}`
      : mappedUrl;

    try {
      const localUrl = await downloadFile(urlWithParams, localPath);

      const size = this.estimateSize(mappedUrl);

      // Keep the original URL as the key because that is the key used by Cache.
      // Older versions keyed mapped localhost URLs, so remove that stale entry
      // when it differs.
      if (mappedUrl !== url) {
        this.fileMap.delete(mappedUrl);
      }
      this.fileMap.set(url, { url: localUrl, size });

      await this.saveFileMap();

      return {
        result: { code: 'SUCCESS' },
        item: {
          url: localUrl,
          size,
        },
      };
    } catch (err) {
      console.error('Error downloading file', err);

      return {
        result: { code: 'FAILURE', errMsg: 'Error downloading file' },
      };
    }
  }

  /*
   * Retrieve a file from the storage. Returns the file path if the file exists,
   */
  async retrieveFile(url: string): Promise<string | void> {
    const file = this.getFileEntry(url)?.file;
    if (!file) {
      return;
    }

    return file.url;
  }

  /*
   * Delete a file from the storage
   */
  async deleteFile(url: string): Promise<void> {
    const entry = this.getFileEntry(url);

    if (entry) {
      await deleteFile(entry.file.url);
      this.fileMap.delete(entry.key);
      await this.saveFileMap();
    } else {
      // Cache replaces a source URL with a newly downloaded local URI before
      // asking the integration to remove the superseded local URI.
      await deleteFile(url);
    }
  }

  /*
   * Delete all files from the storage
   */
  async deleteAllFiles(): Promise<void> {
    deletePath(this.storagePath);
    this.fileMap.clear();

    await this.saveFileMap();
  }

  async close(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /*
   * Generate a unique file name based on the URL. Keep the extension if present.
   * @param {string} url - The URL of the file
   * @returns {string} - The unique file name
   */
  private getFileName(url: string, revision: number): string {
    const pathName = new URL(url).pathname;

    const [, extension] = pathName.split('.');

    const hash = simpleHash(pathName);
    const versionedHash = `${hash}-${revision}`;

    return extension ? `${versionedHash}.${extension}` : versionedHash;
  }

  private getLocalUrl(path: string): string {
    // return `${this.storagePath}/${path}`;
    return path;
  }

  /**
   * Estimate the size of a file based on the URL.
   * Use the file suffix to estimate the size.
   * Videos are assumed to be 10MB
   * Images are assumed to be 1MB
   * Other files are assumed to be 10KB
   */
  private estimateSize(url: string): number {
    const pathName = new URL(url).pathname;
    const [, extension] = pathName.split('.');

    if (extension === 'mp4') {
      return 1e7; // 10MB
    } else if (extension === 'jpg' || extension === 'png') {
      return 1e6; // 1MB
    } else {
      return 1e4; // 10KB
    }
  }

  /**
   * Map localhost url to remote url. Used when server is running on localhost.
   * @param {string} url - The URL to map
   * @returns {string} - The mapped URL
   */
  private mapLocalhostUrl(url: string): string {
    const fileHost = import.meta.env.VITE_FILE_HOST;

    if (!fileHost) {
      return url;
    }

    return url.replace('localhost', fileHost);
  }

  private getFileEntry(
    url: string
  ): { key: string; file: FileData } | undefined {
    const directMatch = this.fileMap.get(url);
    if (directMatch) {
      return { key: url, file: directMatch };
    }

    const mappedUrl = this.mapLocalhostUrl(url);
    const legacyMatch = this.fileMap.get(mappedUrl);
    if (legacyMatch) {
      return { key: mappedUrl, file: legacyMatch };
    }

    for (const [key, file] of this.fileMap.entries()) {
      if (file.url === url) {
        return { key, file };
      }
    }
  }
}
