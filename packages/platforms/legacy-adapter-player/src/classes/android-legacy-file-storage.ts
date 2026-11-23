/**
 * This storage integration uses the API provided by the legacy Android
 * Castmill player app. Compatible media uses native file storage with estimated
 * sizes and a 1GB capacity. Configuration, code, and bounded binary fallbacks
 * use authenticated XHR and persistent data URLs through the key/value API.
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

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  private async loadFileMap(): Promise<Map<string, FileData>> {
    const fileMap = await getItem('FILE_MAP');
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
        await setItem('FILE_MAP', '[]');
      }
    }

    return new Map<string, FileData>();
  }

  private updateFileMap(
    update: (files: Map<string, FileData>) => void
  ): Promise<void> {
    const write = this.fileMapWrites.then(async () => {
      const updated = new Map(this.fileMap);
      update(updated);
      await setItem('FILE_MAP', JSON.stringify(Array.from(updated.entries())));
      this.fileMap = updated;
    });
    // Keep later writes usable after failure; each caller still awaits its error.
    this.fileMapWrites = write.then(
      () => undefined,
      () => undefined
    );
    return write;
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
        if (staleMappedFile) {
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
    // Persist the payload through the wrapper's key/value API, not its ranged
    // downloader. Data URLs also survive offline starts and content changes.
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

    if (entry) {
      if (!entry.file.url.startsWith('data:')) {
        await deleteFile(entry.file.url);
      }
      await this.updateFileMap((files) => {
        if (files.get(entry.key) === entry.file) {
          files.delete(entry.key);
        }
      });
    } else {
      // Cache replaces a source URL with a newly downloaded local URI before
      // asking the integration to remove the superseded local URI.
      if (!url.startsWith('data:')) {
        await deleteFile(url);
      }
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
