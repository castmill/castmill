/**
 * (c) Copyright 2022 Castmill AB, Sweden.
 * AGPL v3.0 License applies by default - see https://www.gnu.org/licenses/agpl-3.0.en.html
 * unless a paid license provided by the copyright holder.
 *
 */
// import "whatwg-fetch";

import { Cache, ItemType } from "./cache";

let resourceManager: ResourceManager;

interface ResourceManagerOpts {
  isOnline?: () => boolean;
  needsRefresh?: () => void;
}

/**
 * The resource manager is responsible for handling all the resources needed by
 * the player. It provides a cache mechanism that minimizes the network requests
 * as well as support for said resources to work offline.
 *
 * The resource manager should be used as a singleton, instantiated once using the
 * provided factory static method.
 *
 * There are three types of resources that have different characteristics.
 *
 * 1) Data resources: These are resources that are loaded from the server and
 * are assumed to have a short freshness period, by defaul JSON data.
 * For example it could be weather data used by a weather widget.
 * Data resources are downloaded by the ResourceManager and stored in the integration.
 *
 * 2) Code resources: These are resources that implement functionality, for
 * example code used by a widget. These resources also have a short freshness
 * period but we must trigger a reload if we know that there is a new version.
 * Code resources are downloaded by the ResourceManager and stored in the integration.
 *
 * 3) Media resources: These resources are considered immutable, often large in size,
 * meaning that once they are cached we will never need to fetch them again as long as
 * they are still cached. Code resources are downloaded by the integration
 * and stored in the integration.
 *
 */
export class ResourceManager {
  /**
   * Singleton factory method
   * @param cache The cache to use for the resource manager.
   * @returns
   */
  static createResourceManager(
    cache: Cache,
    opts: ResourceManagerOpts
  ): ResourceManager {
    resourceManager = resourceManager || new ResourceManager(cache, opts);
    return resourceManager;
  }

  constructor(private cache: Cache, private opts: ResourceManagerOpts = {}) {}

  async init() {
    // Get all the code resources
    const codeResources = await this.cache.list(ItemType.Code);

    // re-fetch all the code resources
    let needRefresh = false;
    for (const codeResource of codeResources) {
      const newCode = await this.fetchCode(codeResource.url);
      if (newCode) {
        const oldCode = await this.fetchCode(codeResource.cachedUrl);

        if (oldCode !== newCode) {
          await this.cache.set(
            codeResource.url,
            ItemType.Code,
            "text/javascript"
          );
          needRefresh = true;
        }
      }
    }

    // Check if any of the code resources has changed, if so call the needsRefresh callback
    // to trigger a reload of the page so that the new code can be used.
    if (needRefresh && this.opts.needsRefresh) {
      await this.opts.needsRefresh();
    }

    await this.cache.init();
  }

  /**
   * Imports a Javascript module from the cache.
   * @param url The url of the module to import.
   */
  // https://stackoverflow.com/questions/47978809/how-to-dynamically-execute-eval-javascript-code-that-contains-an-es6-module-re
  async import<T = any>(url: string): Promise<T | void> {
    let item = await this.cache.get(url);

    if (item) {
      const code = await this.fetchCode(item.cachedUrl);
      const uri = `data:text/javascript,${code};`;
      return import(/* @vite-ignore */ uri) as Promise<T>;
    }

    return this.cache.set(url, ItemType.Code, "text/javascript");
  }

  async getData<T = any>(url: string, freshness: number): Promise<T | void> {
    const item = await this.cache.get(url);
    if (item && Date.now() - item.timestamp < freshness) {
      return this.fetchJson(item.cachedUrl) as Promise<T>;
    } else {
      return this.cache.set(url, ItemType.Data, "application/json", {
        force: true,
      });
    }
  }

  async getMedia(url: string): Promise<string | void> {
    const item = await this.cache.get(url);
    if (!item) {
      return this.cache.set(url, ItemType.Media, "media/*");
    }
    return item.cachedUrl;
  }

  close() {
    this.cache.close();
  }

  /**
   *
   * @param url The url of the data resource to fetch.
   */
  private async fetchJson(
    url: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async fetchCode(
    url: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.text();
      }
    } catch (err) {
      console.error(err);
    }
  }
}
