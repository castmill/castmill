/**
 * This storage integration uses the API provided by the legacy Android
 * Castmill player app. Compatible media uses native file storage with estimated
 * sizes and a 1GB capacity. Configuration, code, and bounded binary fallbacks
 * use authenticated XHR and persistent data URLs in IndexedDB. Native preferences
 * retain only a small database pointer, not the cached payloads.
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
  fileExists,
  deleteFile,
  deletePath,
} from '../android-legacy-api';

interface FileData {
  url: string;
  size: number;
}

const TOTAL_STORAGE = 1e9; // 1GB
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_BINARY_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BINARY_CACHE_BYTES = 8 * 1024 * 1024;
const FILE_MAP_DATABASE = 'castmill-android-files';
const NATIVE_CACHE_URL_PREFIX = 'content://com.optimalbits.fileprovider/cache/';
const FILE_MAP_POINTER = JSON.stringify({
  indexedDB: FILE_MAP_DATABASE,
  version: 1,
});
const BINARY_MIME_TYPES = new Map<string, string>([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['bmp', 'image/bmp'],
  ['svg', 'image/svg+xml'],
  ['ico', 'image/x-icon'],
  ['otf', 'font/otf'],
  ['ttf', 'font/ttf'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
  ['eot', 'application/vnd.ms-fontobject'],
]);

function isNativeCacheUrl(url: string): boolean {
  return (
    url.startsWith(NATIVE_CACHE_URL_PREFIX) &&
    url.length > NATIVE_CACHE_URL_PREFIX.length
  );
}

class BinaryAssetLimitError extends Error {
  constructor(
    readonly code: 'TOO_LARGE' | 'NOT_ENOUGH_SPACE',
    message: string,
    readonly requiredBytes?: number
  ) {
    super(message);
  }
}

export class AndroidLegacyFileStorage implements StorageIntegration {
  private storagePath: string;
  private fileMap = new Map<string, FileData>();
  private fileRevision = Date.now();
  private fileMapWrites: Promise<void> = Promise.resolve();
  private database?: IDBDatabase;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  private loadLegacyFileMap(fileMap: string | null): Map<string, FileData> {
    if (fileMap) {
      try {
        const parsed: unknown = JSON.parse(fileMap);
        if (
          !Array.isArray(parsed) ||
          !parsed.every(
            (entry) =>
              Array.isArray(entry) &&
              entry.length === 2 &&
              typeof entry[0] === 'string' &&
              typeof entry[1] === 'object' &&
              entry[1] !== null &&
              typeof (entry[1] as FileData).url === 'string' &&
              typeof (entry[1] as FileData).size === 'number'
          )
        ) {
          throw new Error('Invalid FILE_MAP structure');
        }
        return new Map(parsed as Array<[string, FileData]>);
      } catch (err) {
        console.error('Error parsing file map', err);
      }
    }

    return new Map<string, FileData>();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Android file cache requires IndexedDB'));
        return;
      }

      let settled = false;
      const request = indexedDB.open(FILE_MAP_DATABASE, 1);
      const fail = (error: Error) => {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };
      const timeout = setTimeout(
        () => fail(new Error('Opening Android file cache timed out')),
        DOWNLOAD_TIMEOUT_MS
      );
      request.onerror = () =>
        fail(request.error || new Error('Opening Android file cache failed'));
      request.onblocked = () =>
        fail(new Error('Opening Android file cache is blocked'));
      request.onupgradeneeded = () => {
        if (settled) {
          request.transaction?.abort();
          return;
        }
        request.result.createObjectStore('files');
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        clearTimeout(timeout);
        database.onversionchange = () => database.close();
        resolve(database);
      };
    });
  }

  private readFileMap(): Promise<Map<string, FileData>> {
    return new Promise((resolve, reject) => {
      const files = new Map<string, FileData>();
      const transaction = this.database!.transaction('files', 'readonly');
      const request = transaction.objectStore('files').openCursor();
      let error: Error | undefined;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const file: unknown = cursor.value;
        if (
          typeof cursor.key !== 'string' ||
          typeof file !== 'object' ||
          file === null ||
          !('url' in file) ||
          typeof file.url !== 'string' ||
          !('size' in file) ||
          typeof file.size !== 'number'
        ) {
          error = new Error('Invalid Android IndexedDB file entry');
          transaction.abort();
          return;
        }
        files.set(cursor.key, { url: file.url, size: file.size });
        cursor.continue();
      };
      transaction.oncomplete = () => resolve(files);
      transaction.onabort = () =>
        reject(
          error ||
            transaction.error ||
            new Error('Reading Android file cache aborted')
        );
    });
  }

  private persistFileMap(
    files: Map<string, FileData>,
    replace = false
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction('files', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          transaction.error || new Error('Writing Android file cache aborted')
        );
      try {
        const store = transaction.objectStore('files');
        if (replace) store.clear();
        else {
          for (const key of this.fileMap.keys()) {
            if (!files.has(key)) store.delete(key);
          }
        }
        for (const [key, file] of files) {
          if (replace || this.fileMap.get(key) !== file) {
            store.put(file, key);
          }
        }
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  private updateFileMap(
    update: (files: Map<string, FileData>) => void
  ): Promise<void> {
    const queuedAt = performance.now();
    const write = this.fileMapWrites.then(async () => {
      const started = performance.now();
      const updated = new Map(this.fileMap);
      update(updated);
      await this.persistFileMap(updated);
      this.fileMap = updated;
      if (import.meta.env.VITE_LOGGING === 'true') {
        console.log(
          `[legacy performance] IndexedDB files=${updated.size} queue=${Math.round(started - queuedAt)}ms persist=${Math.round(performance.now() - started)}ms`
        );
      }
    });
    // Keep later writes usable after failure; each caller still awaits its error.
    this.fileMapWrites = write.then(
      () => undefined,
      () => undefined
    );
    return write;
  }

  async init(): Promise<void> {
    if (this.database) return;
    this.database = await this.openDatabase();
    try {
      const legacy = await getItem('FILE_MAP');
      if (legacy === FILE_MAP_POINTER) {
        this.fileMap = await this.readFileMap();
        return;
      }
      const files = this.loadLegacyFileMap(legacy);
      await this.persistFileMap(files, true);
      const persisted = await this.readFileMap();
      if (
        persisted.size !== files.size ||
        Array.from(files).some(
          ([key, file]) =>
            persisted.get(key)?.url !== file.url ||
            persisted.get(key)?.size !== file.size
        )
      ) {
        throw new Error('Android file cache migration verification failed');
      }
      // Publish only after commit and read-back; failed migrations retain FILE_MAP.
      await setItem('FILE_MAP', FILE_MAP_POINTER);
      this.fileMap = persisted;
      if (import.meta.env.VITE_LOGGING === 'true') {
        console.log(
          `[legacy performance] Migrated ${files.size} Android cache entries to IndexedDB`
        );
      }
    } catch (error) {
      this.database.close();
      this.database = undefined;
      throw error;
    }
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
    await this.fileMapWrites;
    const missing = new Map<string, FileData>();

    for (const [sourceUrl, file] of Array.from(this.fileMap.entries())) {
      if (file.url.startsWith('data:')) {
        continue;
      }
      try {
        if (!(await fileExists(file.url))) {
          missing.set(sourceUrl, file);
        }
      } catch {
        // Older Android wrappers do not expose fileExists. Keep their mappings
        // and retain the pre-existing reconciliation behavior.
        break;
      }
    }

    if (missing.size) {
      await this.updateFileMap((files) => {
        for (const [sourceUrl, file] of missing) {
          if (files.get(sourceUrl) === file) {
            files.delete(sourceUrl);
          }
        }
      });
    }

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

    try {
      if (
        Object.keys(opts?.headers ?? {}).some(
          (key) => key.toLowerCase() === 'range'
        )
      ) {
        throw new Error(
          'Partial download ranges are not supported by the cache'
        );
      }
      if (opts?.type !== 'media') {
        return await this.storeTextFile(url, mappedUrl, opts);
      }

      const extension = this.getBinaryExtension(mappedUrl);
      const isFont = /^(otf|ttf|woff2?|eot)$/.test(extension);
      // This broker is known to omit HEAD lengths and ignore byte ranges.
      const isBrokerImage =
        new URL(mappedUrl).hostname === 'broker.images.castmill.io';
      if (isFont || isBrokerImage) {
        return await this.storeBinaryFile(url, mappedUrl, opts);
      }

      const fileName = this.getFileName(mappedUrl, this.fileRevision++);
      const localPath = this.getLocalUrl(fileName);

      // The legacy media downloader cannot send headers.
      const auth = opts?.headers?.Authorization;
      const nativeUrl = new URL(mappedUrl);
      if (auth) {
        nativeUrl.search += `${nativeUrl.search ? '&' : '?'}auth=${encodeURIComponent(auth)}`;
      }
      const urlWithParams = auth ? nativeUrl.toString() : mappedUrl;
      let localUrl: string;
      try {
        localUrl = await downloadFile(urlWithParams, localPath);
      } catch (err) {
        if (
          BINARY_MIME_TYPES.has(extension) &&
          !(
            typeof err === 'object' &&
            err !== null &&
            'message' in err &&
            err.message === 'CacheFull'
          )
        ) {
          console.warn(
            'Native image download failed; retrying with bounded XHR'
          );
          return await this.storeBinaryFile(url, mappedUrl, opts);
        }
        throw err;
      }

      const size = this.estimateSize(mappedUrl);

      // Keep the original URL as the key because that is the key used by Cache.
      // Older versions keyed mapped localhost URLs, so remove that stale entry
      // when it differs.
      if (mappedUrl !== url) {
        const staleMappedFile = this.fileMap.get(mappedUrl);
        if (staleMappedFile && isNativeCacheUrl(staleMappedFile.url)) {
          await deleteFile(staleMappedFile.url);
        }
      }
      await this.updateFileMap((files) => {
        if (mappedUrl !== url) {
          files.delete(mappedUrl);
        }
        files.set(url, { url: localUrl, size });
      });

      return {
        result: { code: 'SUCCESS' },
        item: {
          url: localUrl,
          size,
        },
      };
    } catch (err) {
      console.error('Error downloading file', err);

      if (err instanceof BinaryAssetLimitError) {
        return {
          result: {
            code: 'FAILURE',
            error: err.code,
            errMsg:
              err.requiredBytes === undefined
                ? err.message
                : String(err.requiredBytes),
          },
        };
      }

      const errorMessage =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof err.message === 'string'
          ? err.message
          : '';

      if (errorMessage === 'CacheFull') {
        return {
          result: {
            code: 'FAILURE',
            error: 'NOT_ENOUGH_SPACE',
            errMsg: String(this.estimateSize(mappedUrl)),
          },
        };
      }

      return {
        result: {
          code: 'FAILURE',
          error: 'UNKNOWN',
          errMsg: errorMessage || 'Error downloading file',
        },
      };
    }
  }

  private getBinaryExtension(url: string): string {
    return (
      /\.([a-z0-9]+)$/i.exec(new URL(url).pathname)?.[1].toLowerCase() ?? ''
    );
  }

  private async storeBinaryFile(
    sourceUrl: string,
    downloadUrl: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', downloadUrl);
      xhr.responseType = 'blob';
      xhr.timeout = DOWNLOAD_TIMEOUT_MS;
      for (const [key, value] of Object.entries(opts?.headers ?? {})) {
        xhr.setRequestHeader(key, value);
      }
      const rejectTooLarge = () =>
        reject(
          new BinaryAssetLimitError(
            'TOO_LARGE',
            'Binary asset exceeds the 2 MiB persistent cache limit'
          )
        );
      xhr.onprogress = (event) => {
        if (event.loaded > MAX_BINARY_FILE_BYTES) {
          rejectTooLarge();
          xhr.abort();
        }
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300 || xhr.status === 206) {
          reject(new Error(`Binary download failed: HTTP ${xhr.status}`));
        } else if (!(xhr.response instanceof Blob)) {
          reject(new Error('Binary download failed: invalid response'));
        } else if (xhr.response.size > MAX_BINARY_FILE_BYTES) {
          rejectTooLarge();
        } else if (xhr.response.size === 0) {
          reject(new Error('Binary download failed: empty response'));
        } else {
          resolve(xhr.response);
        }
      };
      xhr.onerror = () =>
        reject(new Error('Binary download failed: network error'));
      xhr.ontimeout = () =>
        reject(new Error('Binary download failed: request timed out'));
      xhr.onabort = () =>
        reject(new Error('Binary download failed: request aborted'));
      xhr.send();
    });

    const mimeType = blob.type.split(';')[0].trim().toLowerCase();
    const expectedType = BINARY_MIME_TYPES.get(
      this.getBinaryExtension(downloadUrl)
    );
    const binaryType =
      !mimeType || mimeType === 'application/octet-stream'
        ? expectedType
        : mimeType;
    if (
      !binaryType ||
      !(
        binaryType.startsWith('image/') ||
        binaryType.startsWith('font/') ||
        /^application\/(?:x-)?font-(?:sfnt|ttf|otf|truetype|opentype|woff2?)$/.test(
          binaryType
        ) ||
        binaryType === 'application/vnd.ms-opentype' ||
        binaryType === 'application/vnd.ms-fontobject'
      )
    ) {
      throw new Error('Binary download failed: unsupported content type');
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (
          typeof reader.result !== 'string' ||
          !/^data:[^,]*;base64,/.test(reader.result)
        ) {
          reject(new Error('Binary encoding failed: invalid result'));
          return;
        }
        const base64 = reader.result.slice(reader.result.indexOf(',') + 1);
        resolve(
          `data:${binaryType};castmill-revision=${this.fileRevision++};base64,${base64}`
        );
      };
      reader.onerror = () =>
        reject(new Error('Binary encoding failed: read error'));
      reader.onabort = () =>
        reject(new Error('Binary encoding failed: read aborted'));
      reader.readAsDataURL(blob);
    });

    const item = { url: dataUrl, size: blob.size };
    await this.updateFileMap((files) => {
      let binaryBytes = item.size;
      for (const [url, file] of files) {
        if (
          url !== sourceUrl &&
          file.url.startsWith('data:') &&
          file.url.includes(';base64,')
        ) {
          binaryBytes += file.size;
        }
      }
      if (binaryBytes > MAX_BINARY_CACHE_BYTES) {
        throw new BinaryAssetLimitError(
          'NOT_ENOUGH_SPACE',
          'Binary assets exceed the 8 MiB persistent cache budget',
          binaryBytes - MAX_BINARY_CACHE_BYTES
        );
      }
      files.set(sourceUrl, item);
    });
    return { result: { code: 'SUCCESS' }, item };
  }

  private async storeTextFile(
    sourceUrl: string,
    downloadUrl: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    const text = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', downloadUrl);
      xhr.timeout = DOWNLOAD_TIMEOUT_MS;
      for (const [key, value] of Object.entries(opts?.headers ?? {})) {
        xhr.setRequestHeader(key, value);
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.status !== 206) {
          resolve(xhr.responseText);
        } else {
          reject(
            new Error(`Configuration download failed: HTTP ${xhr.status}`)
          );
        }
      };
      xhr.onerror = () =>
        reject(new Error('Configuration download failed: network error'));
      xhr.ontimeout = () =>
        reject(new Error('Configuration download failed: request timed out'));
      xhr.onabort = () =>
        reject(new Error('Configuration download failed: request aborted'));
      xhr.send();
    });

    const mimeType =
      opts?.type === 'code' ? 'text/javascript' : 'application/json';
    // Data URLs preserve offline reads without relying on IndexedDB Blob support.
    const item = {
      url: `data:${mimeType};charset=utf-8;castmill-revision=${this.fileRevision++},${encodeURIComponent(text)}`,
      size: new Blob([text]).size,
    };
    await this.updateFileMap((files) => files.set(sourceUrl, item));
    return { result: { code: 'SUCCESS' }, item };
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
    const localUrl = entry?.file.url ?? url;
    // Cache may evict an uncached HTTPS fallback or a replaced data URL.
    // The deployed APK crashes if ContentResolver receives a non-provider URI.
    if (isNativeCacheUrl(localUrl)) {
      await deleteFile(localUrl);
    }
    if (entry) {
      await this.updateFileMap((files) => {
        if (files.get(entry.key) === entry.file) {
          files.delete(entry.key);
        }
      });
    }
  }

  /*
   * Delete all files from the storage
   */
  async deleteAllFiles(): Promise<void> {
    // Clear the complete storage path rather than only FILE_MAP entries because
    // a corrupt or interrupted map can leave otherwise unreachable orphan files.
    await deletePath(this.storagePath);
    await this.updateFileMap((files) => files.clear());
  }

  async close(): Promise<void> {
    await this.fileMapWrites;
    this.database?.close();
    this.database = undefined;
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
