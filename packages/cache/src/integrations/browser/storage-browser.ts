import {
  StorageIntegration,
  StoreResult,
  StoreError,
} from "../../storage.integration";

export class StorageBrowser implements StorageIntegration {
  prefix = "castmill:storage";
  cacheName: string;
  private cache!: Cache;

  constructor(private name: string) {
    this.cacheName = `${this.prefix}:${this.name}`;
  }

  /**
   * Perform any initialization required by the cache.
   */
  async init() {
    if (navigator.serviceWorker !== undefined) {
      this.cache = await caches.open(this.cacheName);

      // Delete all caches that are not the current cache.
      // Uses a prefix to avoid deleting unintended caches.
      const keyList = await caches.keys();
      await Promise.all(
        keyList.map((key) => {
          if (key.startsWith(this.prefix) && key !== this.cacheName) {
            return caches.delete(key);
          }
        })
      );

      try {
        const registration = await navigator.serviceWorker.register("sw.js");
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope
        );
      } catch (err) {
        console.log("ServiceWorker registration failed: ", err);
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      if (registration) {
        await registration.update();
      }
    }
  }

  /**
   *
   */
  async info() {
    return {
      used: 0,
      total: 0,
    };
  }

  /**
   * List the files of the cache, if possible support pagination.
   */
  async listFiles() {
    return (
      await Promise.all(
        (
          await this.cache.keys()
        ).map((request) => this.cache.match(request.url))
      )
    ).map((response) => {
      return {
        url: response!.url,
        size: parseInt(response!.headers.get("Content-Length") || "0"),
      };
    });
  }

  /**
   * Store a file for a given url. The file must be downloaded and
   * stored by the integration in the most efficient way for the
   * given platform.
   *
   * @param url
   */
  async storeFile(url: string) {
    try {
      const request = new Request(url, { mode: "cors", method: "GET" });
      await this.cache.add(request);

      const response = await this.cache.match(url);
      if (response?.ok) {
        return {
          item: {
            url,
            size: parseInt(response.headers.get("Content-Length") || "0"),
          },
          result: {
            code: StoreResult.Success,
          },
        };
      } else {
        return {
          result: {
            code: StoreResult.Failure,
            error: StoreError.Unknown,
            errMsg: response?.statusText,
          },
        };
      }
    } catch (err) {
      console.error(err);
      return {
        result: {
          code: StoreResult.Failure,
          error: StoreError.NotFound,
          errMsg: (err as Error).message,
        },
      };
    }
  }

  /**
   * Retrieves a uri like string representing a file in the storage.
   *
   * NOTE:  Maybe not needed since we are storing the uri in indexedDB.
   * @param key
   */
  async retrieveFile(key: string): Promise<string | void> {}

  /**
   * Deletes a file from the storage.
   *
   * @param key
   *
   */
  async deleteFile(url: string) {
    await this.cache.delete(url);
  }

  /**
   * Deletes all the files from the storage
   */
  async deleteAllFiles() {
    await caches.delete(this.cacheName);
  }

  async close() {}
}
