/**
 * (c) Copyright 2022 Castmill AB, Sweden.
 * AGPL v3.0 License applies by default - see https://www.gnu.org/licenses/agpl-3.0.en.html
 * unless a paid license provided by the copyright holder.
 *
 */
// import "whatwg-fetch";

import { Cache, ItemType } from './cache';

let resourceManager: ResourceManager;

interface ResourceManagerOpts {
  authToken?: string;
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
 * they are still cached. Media resources are downloaded by the integration
 * and stored in the integration.
 *
 */
export class ResourceManager {
  private authHeader?: string;

  /**
   * Singleton factory method
   * TODO: determine if we really need this singleton behaviour, and if not, remove it.
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

  constructor(
    private cache: Cache,
    private opts: ResourceManagerOpts = {}
  ) {
    this.authHeader = opts.authToken ? `Bearer ${opts.authToken}` : undefined;
  }

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
            'text/javascript',
            { force: true, headers: this.getAuthHeader() }
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

    if (!item) {
      item = await this.cache.set(url, ItemType.Code, 'text/javascript', {
        headers: this.getAuthHeader(),
        force: false,
      });
    }

    if (item) {
      const uri = await this.buildCodeDataUri(item.cachedUrl);
      return import(/* @vite-ignore */ uri) as Promise<T>;
    }
  }

  private async buildCodeDataUri(url: string): Promise<string> {
    const code = await this.fetchCode(url);
    if (!code) {
      throw Error(`Failed to fetch code for ${url}`);
    }
    return `data:text/javascript,${code};`;
  }

  /**
   * getData
   *
   * Returns possibly cached data for a given URL. If the data is not cached it will
   * be cached and returned if possible.
   *
   * @param url
   * @param freshness
   * @param opts
   * @returns
   */
  async getData<T = any>(url: string, freshness: number): Promise<T | void> {
    let item = await this.cache.get(url);
    const age = item ? Date.now() - item.timestamp : Infinity;

    if (!item || age > freshness) {
      item = await this.cache.set(url, ItemType.Data, 'application/json', {
        headers: this.getAuthHeader(),
        force: true,
      });
    }
    if (item) {
      return this.fetchJson(item.cachedUrl) as Promise<T>;
    }
  }

  /**
   *
   * getMedia
   *
   * Returns the cached media for a given URL. If the media is not cached it will
   * be cached but no URL will be returned.
   *
   * @param url of the media to get.
   *
   * @returns
   */
  async getMedia(url: string): Promise<string | void> {
    // We must not cache data uris
    if (url.startsWith('data:')) {
      return url;
    }

    let item = await this.cache.get(url);
    if (!item) {
      item = await this.cache.set(url, ItemType.Media, 'media/*', {
        headers: this.getAuthHeader(),
        force: false,
      });
    }
    return item?.cachedUrl;
  }

  /**
   *
   *  cacheMedia
   *
   *  Caches a media resource if it is not cached already.
   *  This is useful when we just want to cache a resource
   *  without returning it, for example when preloading media resources to be used later.
   *
   * @param url
   */
  async cacheMedia(url: string): Promise<void> {
    // We must not cache data uris
    if (url.startsWith('data:')) {
      return;
    }

    if (await this.cache.hasUrl(url)) {
      return;
    }

    await this.cache.set(url, ItemType.Media, 'media/*', {
      headers: this.getAuthHeader(),
      force: false,
    });
  }

  close() {
    this.cache.close();
  }

  /**
   *
   * @param url The url of the data resource to fetch.
   */
  private async fetchJson(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async fetchCode(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...this.getAuthHeader(),
        },
      });
      if (response.ok) {
        return response.text();
      }
    } catch (err) {
      console.error(err);
    }
  }

  private getAuthHeader(): { Authorization: string } | {} {
    if (this.authHeader) {
      return { Authorization: this.authHeader };
    } else {
      return {};
    }
  }
}
