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
