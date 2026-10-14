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
/** Larger data/code responses stay session-only to bound internal storage use. */
export const MAX_PERSISTED_TEXT_BYTES = 5 * 1024 * 1024;
let nextDownload = 0;

type TextType = ItemType.Code | ItemType.Data;

interface NativeFile {
  url: string;
  size: number;
  /** Data/code saved for offline cold starts; absent for native media. */
  type?: TextType;
  storedAt?: number;
}

const TEXT_MIME_TYPES: Record<TextType, string> = {
  [ItemType.Code]: 'text/javascript',
  [ItemType.Data]: 'application/json',
};

function isTextType(type: unknown): type is TextType {
  return type === ItemType.Code || type === ItemType.Data;
}

/**
 * Persisted data/code keep their source URL in localStorage, so only plain
 * http(s) URLs without query strings, fragments, or credentials are eligible.
 */
function isPersistableTextUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function isFileMap(value: unknown): value is Array<[string, NativeFile]> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        (entry[1]?.type === undefined
          ? canDownloadNatively(entry[0], 'null')
          : isTextType(entry[1].type) &&
            isPersistableTextUrl(entry[0]) &&
            typeof entry[1].storedAt === 'number' &&
            Number.isFinite(entry[1].storedAt)) &&
        typeof entry[1]?.url === 'string' &&
        webosNativePath(entry[1].url) !== undefined &&
        typeof entry[1]?.size === 'number' &&
        Number.isFinite(entry[1].size) &&
        entry[1].size >= 0
    )
  );
}

/** SCAP readFile/writeFile transfer at most 10 KB per call. */
export const SCAP_IO_CHUNK_BYTES = 10 * 1024;

async function writeChunked(path: string, buffer: ArrayBuffer): Promise<void> {
  for (
    let offset = 0;
    offset < buffer.byteLength;
    offset += SCAP_IO_CHUNK_BYTES
  ) {
    await storage.writeFile({
      path,
      data: buffer.slice(offset, offset + SCAP_IO_CHUNK_BYTES),
      encoding: 'binary',
      mode: offset === 0 ? 'truncate' : 'append',
    });
  }
}

async function readChunked(path: string, size: number): Promise<ArrayBuffer[]> {
  const chunks: ArrayBuffer[] = [];
  for (let position = 0; position < size; position += SCAP_IO_CHUNK_BYTES) {
    const length = Math.min(SCAP_IO_CHUNK_BYTES, size - position);
    const { data } = await storage.readFile({
      path,
      position,
      length,
      encoding: 'binary',
    });
    if (!(data instanceof ArrayBuffer) || data.byteLength !== length) {
      throw new Error('Cached file is shorter than recorded');
    }
    chunks.push(data);
  }
  return chunks;
}

// Cordova's webOS plugin replaces window.FileReader with a readAsText-only
// shim, so blob contents are read with XHR instead.
function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () =>
      xhr.response && typeof xhr.response.byteLength === 'number'
        ? resolve(xhr.response)
        : reject(new Error('Unable to read cached resource'));
    xhr.onerror = () => reject(new Error('Unable to read cached resource'));
    xhr.send();
  });
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
  /** Session blob URLs for persisted data/code, keyed by source URL. */
  private textUrls = new Map<string, string>();
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
    await this.restoreTextFiles();
  }

  /** Loads persisted data/code into session blob URLs for offline startup. */
  private async restoreTextFiles(): Promise<void> {
    const restored = new Map(this.files);
    for (const [sourceUrl, file] of this.files) {
      if (!file.type) continue;
      const path = webosNativePath(file.url)!;
      try {
        const chunks = await readChunked(path, file.size);
        this.textUrls.set(
          sourceUrl,
          URL.createObjectURL(
            new Blob(chunks, { type: TEXT_MIME_TYPES[file.type] })
          )
        );
      } catch (error) {
        console.error('WebOS Storage: unable to restore cached data', error);
        restored.delete(sourceUrl);
        try {
          await storage.removeFile({ file: path });
        } catch (cleanupError) {
          console.error(
            'WebOS Storage: failed to remove unreadable data',
            cleanupError
          );
        }
      }
    }
    if (restored.size !== this.files.size) this.save(restored);
  }

  async info(): Promise<StorageInfo> {
    const native = await storage.getStorageInfo();
    // Persisted data/code also has a session blob; count it only once.
    const memory = (await this.browser.listFiles()).filter(
      (file) => !file.sourceUrl || !this.files.has(file.sourceUrl)
    );
    return {
      // SCAP reports storage in KB; cache accounting uses bytes.
      total: native.total * 1024,
      used: [...this.files.values(), ...memory].reduce(
        (sum, file) => sum + file.size,
        0
      ),
    };
  }

  async listFiles(): Promise<StorageItem[]> {
    const persisted: StorageItem[] = [];
    for (const [sourceUrl, file] of this.files) {
      const url = file.type ? this.textUrls.get(sourceUrl) : file.url;
      if (!url) continue;
      persisted.push({
        sourceUrl,
        url,
        size: file.size,
        ...(file.type ? { type: file.type, storedAt: file.storedAt } : {}),
      });
    }
    const memory = (await this.browser.listFiles()).filter(
      (file) => !file.sourceUrl || !this.files.has(file.sourceUrl)
    );
    return [...persisted, ...memory];
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
      let response: StoreFileReturnValue;
      try {
        response = await this.browser.storeFile(url, opts);
      } finally {
        this.logger.log('memory download end');
      }
      if (isTextType(opts?.type) && response.result.code === 'SUCCESS') {
        await this.persistText(url, opts.type, response.item);
      }
      return response;
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

  /**
   * Saves downloaded data/code to internal storage so an offline cold start
   * can play the last known channels, playlists, and widgets. The resource is
   * downloaded with authenticated XHR; SCAP only writes the text locally.
   * Failures keep the session copy and never fail the download.
   */
  private async persistText(
    url: string,
    type: TextType,
    item: StorageItem | undefined
  ): Promise<void> {
    if (!item?.url || !isPersistableTextUrl(url)) return;
    const previous = this.files.get(url);
    const previousUrl = this.textUrls.get(url);
    if (item.size === 0 || item.size > MAX_PERSISTED_TEXT_BYTES) {
      // An older copy must not outlive a newer, unpersistable response.
      await this.dropText(url, item.url);
      return;
    }
    const storedAt = Date.now();
    const filename = `${sha256(`${url}#${storedAt}#${++nextDownload}`)}.${type === ItemType.Code ? 'js' : 'json'}`;
    const filePath = `${CACHE_PATH}/${filename}`;
    const tempPath = `${filePath}-${nextDownload}.tmp`;
    try {
      const buffer = await fetchArrayBuffer(item.url);
      if (buffer.byteLength !== item.size) {
        throw new Error('Downloaded data changed before it was saved');
      }
      await writeChunked(tempPath, buffer);
      const { size } = await storage.statFile({ path: tempPath });
      if (size !== buffer.byteLength) {
        throw new Error('Cached file size does not match the download');
      }
      await storage.moveFile({ oldPath: tempPath, newPath: filePath });
    } catch (error) {
      console.error('WebOS Storage: unable to persist cached data', error);
      try {
        await storage.removeFile({ file: tempPath });
      } catch {
        // The temporary file may not exist.
      }
      await this.dropText(url, item.url);
      return;
    }
    const updated = new Map(this.files);
    const file: NativeFile = {
      url: `${EXTERNAL_PATH}/${filename}`,
      size: item.size,
      type,
      storedAt,
    };
    updated.set(url, file);
    try {
      this.save(updated);
    } catch (error) {
      console.error('WebOS Storage: unable to record cached data', error);
      await this.removeNativeFile(file);
      await this.dropText(url, item.url);
      return;
    }
    this.textUrls.set(url, item.url);
    if (previous?.type) await this.removeNativeFile(previous);
    if (previousUrl && previousUrl !== item.url) this.revokeText(previousUrl);
    this.logger.log(
      `persisted ${type} file=${filename.slice(0, 12)} size=${item.size}`
    );
  }

  /** Forgets a persisted copy superseded by a newer session-only download. */
  private async dropText(sourceUrl: string, currentUrl: string): Promise<void> {
    const blobUrl = this.textUrls.get(sourceUrl);
    this.textUrls.delete(sourceUrl);
    if (blobUrl && blobUrl !== currentUrl) this.revokeText(blobUrl);
    const file = this.files.get(sourceUrl);
    if (file?.type) await this.removeNative(sourceUrl, file);
  }

  private async removeNative(
    sourceUrl: string,
    file: NativeFile
  ): Promise<void> {
    const updated = new Map(this.files);
    updated.delete(sourceUrl);
    this.save(updated);
    await this.removeNativeFile(file);
  }

  private async removeNativeFile(file: NativeFile): Promise<void> {
    const path = webosNativePath(file.url);
    if (!path) return;
    try {
      if ((await storage.exists({ path })).exists) {
        await storage.removeFile({ file: path });
      }
    } catch (error) {
      console.error('WebOS Storage: failed to remove cached file', error);
    }
  }

  private revokeText(blobUrl: string): void {
    URL.revokeObjectURL(blobUrl);
    void this.browser.deleteFile(blobUrl);
  }

  async retrieveFile(url: string): Promise<string | void> {
    const file = this.files.get(url);
    if (file && !file.type) return file.url;
    return this.textUrls.get(url) ?? this.browser.retrieveFile(url);
  }

  async deleteFile(url: string): Promise<void> {
    const text = Array.from(this.files).find(
      ([sourceUrl, file]) =>
        file.type &&
        (sourceUrl === url ||
          file.url === url ||
          this.textUrls.get(sourceUrl) === url)
    );
    if (text) {
      const blobUrl = this.textUrls.get(text[0]);
      this.textUrls.delete(text[0]);
      if (blobUrl) this.revokeText(blobUrl);
      await this.removeNative(text[0], text[1]);
      return;
    }
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
    this.revokeRestoredText();
    await this.browser.deleteAllFiles();
  }

  async close(): Promise<void> {
    this.revokeRestoredText();
    await this.browser.close();
  }

  private revokeRestoredText(): void {
    for (const url of this.textUrls.values()) URL.revokeObjectURL(url);
    this.textUrls.clear();
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
