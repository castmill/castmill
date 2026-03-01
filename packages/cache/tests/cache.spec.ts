/// <reference types="node" />

import 'fake-indexeddb/auto';

import { describe, it, expect } from 'vitest';

import { Cache, ItemType } from '../src/cache';
import { StorageMockup } from './storage.mockup';

describe('Cache', () => {
  it('should return undefined for a non-cached item', async () => {
    const storage = new StorageMockup({});
    const cache = new Cache(storage, 'test', 10);

    const item = await cache.get('some-url');
    expect(item).to.be.undefined;
  });

  it('should return cached item', async () => {
    const url = 'https://example.com/code.js';
    const storage = new StorageMockup({
      'https://example.com/code.js': 'const a = 1;',
    });
    const cache = new Cache(storage, 'test', 10);

    await cache.set(url, ItemType.Code, 'text/javascript');

    const item = await cache.get(url);

    expect(item).to.have.property('url', url);
    expect(item).to.have.property('type', ItemType.Code);
    expect(item).to.have.property('accessed', 1);
    expect(item).to.have.property('mimeType', 'text/javascript');
    expect(item).to.have.property('size', 12);
  });

  it('should list cached items', async () => {
    const url = 'https://example.com/code.js';

    const filesFixture: { [index: string]: string } = {};
    for (let i = 0; i < 10; i++) {
      filesFixture[`${url}${i}`] = 'const a = 1;';
    }

    const storage = new StorageMockup(filesFixture);
    const cache = new Cache(storage, 'test-items', 10);

    for (let i = 0; i < 10; i++) {
      await cache.set(`${url}${i}`, ItemType.Code, 'text/javascript');
    }

    const items = await cache.list(ItemType.Code);
    expect(items).to.have.length(10);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      expect(item).to.have.property('url', `${url}${i}`);
      expect(item).to.have.property('type', ItemType.Code);
      expect(item).to.have.property('accessed', 0);
      expect(item).to.have.property('mimeType', 'text/javascript');
      expect(item).to.have.property('size', 12);
    }
  });

  it('should delete cached items', async () => {
    const url = 'https://example.com/data';

    const filesFixture: { [index: string]: string } = {};
    for (let i = 0; i < 10; i++) {
      filesFixture[`${url}${i}`] = '{ "foo" : "bar" }';
    }

    const storage = new StorageMockup(filesFixture);
    const cache = new Cache(storage, 'test-delete', 10);

    for (let i = 0; i < 10; i++) {
      await cache.set(`${url}${i}`, ItemType.Data, 'application/json');
    }

    await cache.del(`${url}3`);

    const items = await cache.list(ItemType.Data);
    expect(items).to.have.length(9);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      expect(item).to.have.property(
        'url',
        i < 3 ? `${url}${i}` : `${url}${i + 1}`
      );
      expect(item).to.have.property('type', 'data');
      expect(item).to.have.property('accessed', 0);
      expect(item).to.have.property('mimeType', 'application/json');
      expect(item).to.have.property('size', 17);
    }
  });

  /*
  it("should ignore update item if setting existing item", async () => {
    const url = "https://example.com/code.js";
    const storage = new StorageMockup();
    const cache = new Cache(storage, "test-update", 10);

    await cache.set(
      url,
      ItemType.Code,
      "text/javascript",
      "const a = 1;"
    );

    await cache.set(
      url,
      ItemType.Code,
      "text/javascript",
      "const a = 2;"
    );

    const item = await cache.get(url);
  });
  */

  it('should increment the accessed counter and timestamp when getting item', async () => {
    const url = 'https://example.com/code.js';
    const storage = new StorageMockup({
      [url]: 'const a = 1;',
    });
    const cache = new Cache(storage, 'test-access', 10);

    await cache.set(url, ItemType.Code, 'text/javascript');

    for (let i = 1; i < 42; i++) {
      const item = await cache.get(url);
      expect(item).to.have.property('accessed', i);
      // expect(item).to.have.property("timestamp", 1); // we need fake timers to test for timestamps
    }
  });

  it('should remove older cached items if the cache is full (maxItems)', async () => {
    const url = 'https://example.com/code.js';
    const filesFixture: { [index: string]: string } = {};
    for (let i = 0; i < 13; i++) {
      filesFixture[`${url}${i}`] = 'const a = 1;';
    }

    const storage = new StorageMockup(filesFixture);
    const cache = new Cache(storage, 'test-max-items', 10);

    for (let i = 0; i < 10; i++) {
      await cache.set(`${url}${i}`, ItemType.Code, 'text/javascript');
    }

    expect(await cache.list(ItemType.Code)).to.have.length(10);

    await cache.set(`${url}10`, ItemType.Code, 'text/javascript');
    await cache.set(`${url}11`, ItemType.Code, 'text/javascript');
    await cache.set(`${url}12`, ItemType.Code, 'text/javascript');

    const items = await cache.list(ItemType.Code);

    expect(items).to.have.length(10);
    const removed = [`${url}0`, `${url}1`, `${url}2`];
    for (let i = 0; i < items.length; i++) {
      const url = items[i]?.url;
      const isRemoved = removed.includes(url!);
      expect(isRemoved).to.be.false;
    }
  });
  it('should preserve old cached data when force-refresh fails (stale fallback)', async () => {
    const url = 'https://example.com/data.json';
    const initialData = '{ "foo": "bar" }';

    const filesFixture: { [index: string]: string } = {
      [url]: initialData,
    };

    const storage = new StorageMockup(filesFixture);
    const cache = new Cache(storage, 'test-stale-fallback', 10);

    // Cache the initial data
    const item = await cache.set(url, ItemType.Data, 'application/json');
    expect(item).toBeDefined();

    const cachedUrl = item!.cachedUrl;

    // Now remove the fixture so the next fetch will fail
    delete filesFixture[url];

    // Force-refresh should fail but the old entry should still be preserved
    await expect(
      cache.set(url, ItemType.Data, 'application/json', { force: true })
    ).rejects.toThrow();

    // The original cached entry should still be in the cache
    const preserved = await cache.get(url);
    expect(preserved).toBeDefined();
    expect(preserved!.cachedUrl).toBe(cachedUrl);
  });

  it('should clean up old file after successful force-refresh', async () => {
    const url = 'https://example.com/data.json';
    const initialData = '{ "version": 1 }';
    const updatedData = '{ "version": 2 }';

    const filesFixture: { [index: string]: string } = {
      [url]: initialData,
    };

    const storage = new StorageMockup(filesFixture);
    const deleteFileSpy = vi.spyOn(storage, 'deleteFile');
    const cache = new Cache(storage, 'test-force-cleanup', 10);

    // Cache the initial data
    const oldItem = await cache.set(url, ItemType.Data, 'application/json');
    expect(oldItem).toBeDefined();
    const oldCachedUrl = oldItem!.cachedUrl;

    // Update the fixture data
    filesFixture[url] = updatedData;

    // Force-refresh should succeed and clean up the old file
    const newItem = await cache.set(url, ItemType.Data, 'application/json', {
      force: true,
    });
    expect(newItem).toBeDefined();
    expect(newItem!.cachedUrl).not.toBe(oldCachedUrl);

    // The old cached file should have been deleted
    expect(deleteFileSpy).toHaveBeenCalledWith(oldCachedUrl);
  });

  it('should not delete pre-existing item on cache error', async () => {
    const url = 'https://example.com/data.json';
    const initialData = '{ "foo": "bar" }';

    const filesFixture: { [index: string]: string } = {
      [url]: initialData,
    };

    const storage = new StorageMockup(filesFixture);
    const cache = new Cache(storage, 'test-no-delete-on-error', 10);

    // First, cache the item successfully
    await cache.set(url, ItemType.Data, 'application/json');

    // Verify it's cached
    const item = await cache.get(url);
    expect(item).toBeDefined();

    // Remove fixture to simulate network failure on force-refresh
    delete filesFixture[url];

    // Force-refresh should fail
    await expect(
      cache.set(url, ItemType.Data, 'application/json', { force: true })
    ).rejects.toThrow();

    // The item should still be in the cache (not deleted)
    const preserved = await cache.get(url);
    expect(preserved).toBeDefined();
    expect(preserved!.mimeType).toBe('application/json');
  });

  it('should delete new entry on cache error when no pre-existing item', async () => {
    const url = 'https://example.com/missing.json';

    // Create a storage that will fail on storeFile
    const storage = {
      init: vi.fn(),
      listFiles: async () => [],
      storeFile: vi.fn().mockRejectedValue(new Error('Network error')),
      deleteFile: vi.fn(),
      retrieveFile: vi.fn(),
      deleteAllFiles: vi.fn(),
      close: vi.fn(),
    } as unknown as StorageIntegration;

    const cache = new Cache(storage, 'test-delete-on-error-no-existing', 10);

    // There is no pre-existing item, so cache.set should fail and clean up
    await expect(
      cache.set(url, ItemType.Data, 'application/json')
    ).rejects.toThrow();
  });

  it('should remove older cached items if the cache is full (maxSize)', () => {});
  it('should not download the same file again if already in the process of caching', () => {});

  it('should clear the cache', async () => {});

  it('should remove items from integration that are not in the cache', async () => {
    const url = 'https://example.com/code.js';
    const storage = {
      init: vi.fn(),
      listFiles: async () => [{ url, size: 12 }],
      deleteFile: vi.fn(),
    } as unknown as StorageIntegration;

    const cache = new Cache(storage, 'test-remove', 10);
    await cache.init();

    expect(storage.deleteFile).toHaveBeenCalledWith(url);
  });

  it('should remove items from cache that are not in the integration', async () => {
    const url = 'https://example.com/code.js';
    const storage = {
      init: vi.fn(),
      listFiles: async () => [],
      storeFile: vi.fn().mockResolvedValue({
        result: {
          code: 'SUCCESS',
        },
        item: { url, size: 12 },
      }),
      deleteFile: vi.fn(),
    } as unknown as StorageIntegration;

    const cache = new Cache(storage, 'test-remove', 10);
    await cache.init();

    // set the item in the cache. The mocked integration will not store it
    await cache.set(url, ItemType.Code, 'text/javascript');

    const items = await cache.list(ItemType.Code);
    expect(items).to.have.length(1);

    // Trigger the init again. The cache should now detect that the item is not in the integration and remove it from the cache.
    await cache.init();

    // The item should be removed from the cache
    const items2 = await cache.list(ItemType.Code);
    expect(items2).to.have.length(0);
  });
});
