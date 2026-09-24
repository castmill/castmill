import {
  ItemType,
  type StorageIntegration,
  type StorageInfo,
  type StorageItem,
  type StoreFileReturnValue,
  type StoreOptions,
} from '@castmill/cache';
import {
  clearWebosFiles,
  fetchWebosFile,
  removeWebosFile,
} from '../webos-legacy-api';
import { WebosMemoryFileStorage } from './webos-memory-file-storage';

interface NativeFile {
  url: string;
  size: number;
}

const FILE_MAP_KEY = 'castmill-webos-file-map';
const NATIVE_URL =
  /^http:\/\/127\.0\.0\.1:9080\/castmill-cache\/([a-f0-9]{64}(?:\.[a-z0-9_-]+)?)$/i;

function nativePath(url: string): string | undefined {
  const match = NATIVE_URL.exec(url);
  return match ? `file://internal/castmill-cache/${match[1]}` : undefined;
}

export function isWebosNativeUrl(url: string): boolean {
  return nativePath(url) !== undefined;
}

export class WebosLegacyFileStorage implements StorageIntegration {
  private readonly browser = new WebosMemoryFileStorage();
  private files = new Map<string, NativeFile>();

  async init(): Promise<void> {
    const saved = localStorage.getItem(FILE_MAP_KEY);
    if (!saved) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch (error) {
      console.error('Invalid WebOS native file map', error);
      await this.resetNativeFiles();
      return;
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (entry) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1]?.url === 'string' &&
          nativePath(entry[1].url) !== undefined &&
          typeof entry[1]?.size === 'number' &&
          Number.isFinite(entry[1].size) &&
          entry[1].size >= 0
      )
    ) {
      console.error('Invalid WebOS native file map structure');
      await this.resetNativeFiles();
      return;
    }
    this.files = new Map(parsed as Array<[string, NativeFile]>);
  }

  async info(): Promise<StorageInfo> {
    const browser = await this.browser.info();
    return {
      total: browser.total,
      used:
        browser.used +
        Array.from(this.files.values()).reduce(
          (sum, file) => sum + file.size,
          0
        ),
    };
  }

  async listFiles(): Promise<StorageItem[]> {
    return [
      ...(await this.browser.listFiles()),
      ...Array.from(this.files.entries()).map(([sourceUrl, file]) => ({
        sourceUrl,
        ...file,
      })),
    ];
  }

  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    if (opts?.type !== ItemType.Media || !this.canDownloadNatively(url)) {
      return this.browser.storeFile(url, opts);
    }

    const file = await fetchWebosFile(url);
    const path = typeof file?.url === 'string' && nativePath(file.url);
    if (
      !path ||
      typeof file.size !== 'number' ||
      !Number.isFinite(file.size) ||
      file.size < 0
    ) {
      throw new Error('WebOS wrapper returned an invalid cached file');
    }

    const previous = this.files.get(url);
    const updated = new Map(this.files);
    updated.set(url, file);
    try {
      localStorage.setItem(FILE_MAP_KEY, JSON.stringify(Array.from(updated)));
    } catch (error) {
      if (previous?.url !== file.url) {
        await removeWebosFile(path);
      }
      throw error;
    }
    this.files = updated;
    return { result: { code: 'SUCCESS' }, item: { ...file, sourceUrl: url } };
  }

  async retrieveFile(url: string): Promise<string | void> {
    return this.files.get(url)?.url ?? this.browser.retrieveFile(url);
  }

  async deleteFile(url: string): Promise<void> {
    const entry = this.files.get(url)
      ? { sourceUrl: url, file: this.files.get(url)! }
      : Array.from(this.files.entries())
          .map(([sourceUrl, file]) => ({ sourceUrl, file }))
          .find(({ file }) => file.url === url);
    const path = entry ? nativePath(entry.file.url) : nativePath(url);
    if (!path) {
      await this.browser.deleteFile(url);
      return;
    }
    await removeWebosFile(path);
    if (entry) {
      const updated = new Map(this.files);
      updated.delete(entry.sourceUrl);
      localStorage.setItem(FILE_MAP_KEY, JSON.stringify(Array.from(updated)));
      this.files = updated;
    }
  }

  async deleteAllFiles(): Promise<void> {
    await this.resetNativeFiles();
    await this.browser.deleteAllFiles();
  }

  async close(): Promise<void> {
    await this.browser.close();
  }

  private canDownloadNatively(url: string): boolean {
    const parsed = new URL(url);
    // The wrapper cannot send headers and logs the input URL. Keep signed or
    // token-bearing URLs in the browser store instead of exposing credentials.
    if (parsed.search || parsed.username || parsed.password || parsed.hash) {
      return false;
    }
    return (
      parsed.pathname.startsWith('/medias/') ||
      parsed.origin !== window.location.origin
    );
  }

  private async resetNativeFiles(): Promise<void> {
    await clearWebosFiles();
    localStorage.setItem(FILE_MAP_KEY, '[]');
    this.files.clear();
  }
}
