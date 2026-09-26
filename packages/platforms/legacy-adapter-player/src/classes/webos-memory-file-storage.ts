import type {
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
  StoreOptions,
} from '@castmill/cache';

const DOWNLOAD_TIMEOUT_MS = 30_000;

export class WebosMemoryFileStorage {
  private readonly files = new Map<string, StorageItem>();
  private readonly urls = new Map<string, string>();

  async info(): Promise<StorageInfo> {
    return {
      total: 0,
      used: Array.from(this.files.values()).reduce(
        (total, file) => total + file.size,
        0
      ),
    };
  }

  async listFiles(): Promise<StorageItem[]> {
    return Array.from(this.files.values());
  }

  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.timeout = DOWNLOAD_TIMEOUT_MS;
      for (const [key, value] of Object.entries(opts?.headers ?? {})) {
        xhr.setRequestHeader(key, value);
      }
      xhr.onload = () => {
        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          xhr.response instanceof Blob
        ) {
          resolve(xhr.response);
        } else {
          reject(new Error(`Failed to download resource: HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () =>
        reject(new Error('Failed to download resource: network error'));
      xhr.ontimeout = () =>
        reject(new Error('Failed to download resource: request timed out'));
      xhr.send();
    });
    const cachedUrl = URL.createObjectURL(blob);
    const item = { sourceUrl: url, url: cachedUrl, size: blob.size };
    this.files.set(url, item);
    this.urls.set(cachedUrl, url);
    return { result: { code: 'SUCCESS' }, item };
  }

  async retrieveFile(url: string): Promise<string | void> {
    return this.files.get(url)?.url;
  }

  async deleteFile(key: string): Promise<void> {
    const sourceUrl = this.files.has(key) ? key : this.urls.get(key);
    if (!sourceUrl) return;
    const cachedUrl = this.files.has(key) ? this.files.get(key)!.url : key;
    URL.revokeObjectURL(cachedUrl);
    this.urls.delete(cachedUrl);
    if (this.files.get(sourceUrl)?.url === cachedUrl) {
      this.files.delete(sourceUrl);
    }
  }

  async deleteAllFiles(): Promise<void> {
    for (const url of this.urls.keys()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.files.clear();
  }

  async close(): Promise<void> {
    await this.deleteAllFiles();
  }
}
