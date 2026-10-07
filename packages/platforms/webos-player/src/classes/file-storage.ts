import {
  ItemType,
  type StorageIntegration,
  type StorageInfo,
  type StorageItem,
  type StoreFileReturnValue,
  type StoreOptions,
} from '@castmill/cache';
import { sha256 } from 'js-sha256';
import { storage } from '../native';
import {
  canDownloadNatively,
  Logger,
  WebosMemoryFileStorage,
  webosNativePath,
} from '../shared';

export { isWebosNativeUrl } from '../shared';

const CACHE_PATH = 'file://internal/castmill-cache';
const EXTERNAL_PATH = 'http://127.0.0.1:9080/castmill-cache';
const FILE_MAP_KEY = 'castmill-webos-native-file-map';
let nextDownload = 0;

interface NativeFile {
  url: string;
  size: number;
}

function isFileMap(value: unknown): value is Array<[string, NativeFile]> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        canDownloadNatively(entry[0], 'null') &&
        typeof entry[1]?.url === 'string' &&
        webosNativePath(entry[1].url) !== undefined &&
        typeof entry[1]?.size === 'number' &&
        Number.isFinite(entry[1].size) &&
        entry[1].size >= 0
    )
  );
}

function isCapacityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { errorCode, errorText, code, message } = error as {
    errorCode?: unknown;
    errorText?: unknown;
    code?: unknown;
    message?: unknown;
  };
  return (
    code === 'ENOSPC' ||
    errorCode === 'NOT_ENOUGH_SPACE' ||
    [errorText, message].some(
      (text) =>
        typeof text === 'string' &&
        /^(?:CacheFull|disk full|storage full|not enough space|no space left on device|ENOSPC(?::.*)?)$/i.test(
          text.trim()
        )
    )
  );
}

export class FileStorage implements StorageIntegration {
  private readonly browser = new WebosMemoryFileStorage();
  private readonly logger = new Logger('WebOS Storage');
  private files = new Map<string, NativeFile>();
  private initialized?: Promise<void>;
  private serverOrigin = window.location.origin;

  setServerOrigin(baseUrl: string): void {
    this.serverOrigin = new URL(baseUrl).origin;
  }

  init(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.initialize().catch((error: unknown) => {
        this.initialized = undefined;
        throw error;
      });
    }
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    if (!(await storage.exists({ path: CACHE_PATH })).exists) {
      await storage.mkdir({ path: CACHE_PATH });
    }
    const saved = localStorage.getItem(FILE_MAP_KEY);
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (!isFileMap(parsed))
          throw new Error('Invalid native file map structure');
        this.files = new Map(parsed);
      } catch (error) {
        console.error('Invalid WebOS native file map', error);
        await this.deleteAllFiles();
        return;
      }
    }
    // Reconcile native files rather than retaining mappings to missing media.
    const { files } = await storage.listFiles({ path: CACHE_PATH });
    const names = new Set(files.map((file) => file.name));
    const valid = new Map(
      Array.from(this.files).filter(([, file]) =>
        names.has(file.url.slice(file.url.lastIndexOf('/') + 1))
      )
    );
    if (valid.size !== this.files.size) {
      console.warn('WebOS Storage: removed mappings for missing native files');
      this.save(valid);
    }
    // Old pathname-hashed caches have no source map and cannot be restored.
    const referenced = new Set(
      Array.from(valid.values()).map((file) =>
        file.url.slice(file.url.lastIndexOf('/') + 1)
      )
    );
    for (const file of files) {
      if (
        file.name &&
        /^[a-z0-9_.-]+$/i.test(file.name) &&
        !referenced.has(file.name)
      ) {
        await storage.removeFile({ file: `${CACHE_PATH}/${file.name}` });
      }
    }
  }

  async info(): Promise<StorageInfo> {
    const native = await storage.getStorageInfo();
    const memory = await this.browser.info();
    return {
      total: native.total,
      used: Array.from(this.files.values()).reduce(
        (sum, file) => sum + file.size,
        memory.used
      ),
    };
  }

  async listFiles(): Promise<StorageItem[]> {
    return [
      ...Array.from(this.files, ([sourceUrl, file]) => ({
        sourceUrl,
        ...file,
      })),
      ...(await this.browser.listFiles()),
    ];
  }

  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    if (
      opts?.type !== ItemType.Media ||
      !canDownloadNatively(url, this.serverOrigin)
    ) {
      this.logger.log('memory download start');
      try {
        return await this.browser.storeFile(url, opts);
      } finally {
        this.logger.log('memory download end');
      }
    }
    const extension = /\.([a-z0-9_-]+)$/i.exec(new URL(url).pathname)?.[1];
    const filename = `${sha256(url)}${extension ? `.${extension}` : ''}`;
    const filePath = `${CACHE_PATH}/${filename}`;
    const tempPath = `${filePath}-${++nextDownload}.tmp`;
    const externalUrl = `${EXTERNAL_PATH}/${filename}`;
    const previous = this.files.get(url);
    const started = Date.now();
    this.logger.log(`native download start file=${filename.slice(0, 12)}`);
    let moved = false;
    try {
      await storage.copyFile({
        source: mapLocalhostUrl(url),
        destination: tempPath,
      });
      await storage.moveFile({ oldPath: tempPath, newPath: filePath });
      moved = true;
      const { size } = await storage.statFile({ path: filePath });
      if (!Number.isFinite(size) || size < 0) {
        throw new Error('SCAP returned an invalid cached file size');
      }
      const item = { sourceUrl: url, url: externalUrl, size };
      const updated = new Map(this.files);
      updated.set(url, { url: externalUrl, size });
      this.save(updated);
      this.logger.log(
        `native download done file=${filename.slice(0, 12)} afterMs=${Date.now() - started} size=${size}`
      );
      return { result: { code: 'SUCCESS' }, item };
    } catch (error) {
      console.error('WebOS Storage: native download failed', error);
      try {
        if (!moved || previous?.url !== externalUrl) {
          await storage.removeFile({ file: moved ? filePath : tempPath });
        }
      } catch (cleanupError) {
        console.error(
          'WebOS Storage: failed to remove incomplete download',
          cleanupError
        );
      }
      if (isCapacityError(error)) {
        return { result: { code: 'FAILURE', error: 'NOT_ENOUGH_SPACE' } };
      }
      throw error;
    }
  }

  async retrieveFile(url: string): Promise<string | void> {
    return this.files.get(url)?.url ?? this.browser.retrieveFile(url);
  }

  async deleteFile(url: string): Promise<void> {
    const entry = Array.from(this.files).find(
      ([sourceUrl, file]) => sourceUrl === url || file.url === url
    );
    const path = webosNativePath(entry?.[1].url ?? url);
    if (!path) {
      await this.browser.deleteFile(url);
      return;
    }
    // Missing files are already removed; other SCAP errors must remain visible.
    if ((await storage.exists({ path })).exists) {
      await storage.removeFile({ file: path });
    }
    if (entry) {
      const updated = new Map(this.files);
      updated.delete(entry[0]);
      this.save(updated);
    }
  }

  async deleteAllFiles(): Promise<void> {
    await storage.removeFile({ file: CACHE_PATH, recursive: true });
    await storage.mkdir({ path: CACHE_PATH });
    this.save(new Map());
    await this.browser.deleteAllFiles();
  }

  async close(): Promise<void> {
    await this.browser.close();
  }

  private save(files: Map<string, NativeFile>): void {
    localStorage.setItem(FILE_MAP_KEY, JSON.stringify(Array.from(files)));
    this.files = files;
  }
}

function mapLocalhostUrl(url: string): string {
  const fileHost = import.meta.env.VITE_FILE_HOST;
  if (!fileHost) return url;
  const parsed = new URL(url);
  if (parsed.hostname === 'localhost') parsed.hostname = fileHost;
  return parsed.href;
}
