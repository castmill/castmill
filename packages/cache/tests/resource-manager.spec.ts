import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';

import { ResourceManager } from '../src/resource-manager';
import { Cache } from '../src/cache';
import { StorageMockup } from './storage.mockup';

import type { Mock } from 'vitest';

describe('ResourceManager', () => {
  beforeEach(() => {
    // Reset fetch mock to clear histories and restore default implementation
    vi.resetAllMocks();
  });

  describe('code resources', () => {
    it('should trigger refresh callback if code has been updated', async () => {
      const uri = 'https://app.castmill.com/static/js/doohv2/app.js';

      // We need to mock the fetch function as well as the StorageMockup
      // The reason is that the ResourceManager will issue a fetch to check if the
      // code has been updated, but the StorageMockup will read the actual code to store (without fetching it)
      const originalFetch = global.fetch;

      const setFetchMock = (code: string) => {
        global.fetch = vi.fn((url: string) =>
          url == uri
            ? Promise.resolve(
                new Response(code, {
                  status: 200,
                  headers: { 'Content-Type': 'text/javascript' },
                })
              )
            : originalFetch(url)
        ) as unknown as Mock;
      };

      const code1 = 'export const a = 1;';

      setFetchMock(code1);

      // Create a cache with the initial code
      const storage = new StorageMockup({
        [uri]: code1,
      });

      // Create a cache with the initial code
      const cache = new Cache(storage, 'test-resource', 10);
      let needsRefreshCalled = false;
      const manager = new ResourceManager(cache);

      await manager.init();

      // Get the code from the cache
      const { a } = await manager.import(uri);
      expect(a).to.be.eql(1);

      const code2 = 'export const a = 20;';
      setFetchMock(code2);

      const manager2 = new ResourceManager(cache, {
        needsRefresh: () => {
          needsRefreshCalled = true;
        },
      });

      await manager2.init();
      manager2.close();
      cache.close();

      // Check if the needsRefresh callback was called
      expect(needsRefreshCalled).to.be.true;

      global.fetch = originalFetch;
    });

    it('should cache code resources', async () => {
      const storage = new StorageMockup({
        'https://example.com/code.js': 'export const a = 1;',
      });
      const cache = new Cache(storage, 'test-code-resource', 10);
      const manager = new ResourceManager(cache);

      await manager.init();

      const uri = 'https://example.com/code.js';

      // Get from cache
      const { a } = await manager.import(uri);
      expect(a).to.be.eql(1);
    });
  });

  describe('data resources', () => {
    it('should get new data if freshness has expired', async () => {
      // Configure the Mockup to resolve with fresh data
      const uri = 'https://example.com/data.json';
      const initialData = JSON.stringify({ foo: 'initial' });
      const updatedData = JSON.stringify({ foo: 'updated' });

      const filesFixture = {
        [uri]: initialData,
      };

      const storage = new StorageMockup(filesFixture);

      const cache = new Cache(storage, 'test-data-resource', 10);
      const manager = new ResourceManager(cache);
      await manager.init();

      const data1 = await manager.getData(uri, 5000);
      expect(data1).to.be.eql(JSON.parse(initialData));

      // Simulate data update in the fixture
      filesFixture[uri] = updatedData;

      // Get from cache
      const data2 = await manager.getData(uri, 5000);
      expect(data2).to.be.eql(JSON.parse(initialData));

      // Get fresh data
      const data3 = await manager.getData(uri, 0); // 0 milliseconds to simulate expired freshness
      expect(data3).to.be.eql(JSON.parse(updatedData));
    });

    it('should cache data resources', async () => {
      const uri = 'https://example.com/data.json';

      const storage = new StorageMockup({
        [uri]: ' { "foo": "bar" } ',
      });

      const cache = new Cache(storage, 'test-data-resource-2', 10);
      const manager = new ResourceManager(cache);

      await manager.init();

      //  Get Data
      const data = await manager.getData(uri, 5000);
      expect(data).to.be.eql({ foo: 'bar' });
    });
  });

  describe('media resources', () => {
    it('should cache media resources', async () => {
      const storage = new StorageMockup({
        'https://example.com/movie.mp4': 'file:///tmp/movie.mp4',
      });
      const cache = new Cache(storage, 'test-media-resource', 10);
      const manager = new ResourceManager(cache);

      await manager.init();

      const uri = 'https://example.com/movie.mp4';

      // Trigger cache
      const result = await manager.cacheMedia(uri);
      expect(result).to.be.undefined;

      // Get from cache
      const mediaUrl = await manager.getMedia(uri);
      expect(mediaUrl).to.not.be.undefined;
      const media = await fetch(<string>mediaUrl);
      expect(media.status).to.be.eql(200);
      const content = await media.text();
      expect(content).to.be.eql('file:///tmp/movie.mp4');
    });

    it('should rise an error if media not available', async () => {
      const storage = new StorageMockup({
        'https://example.com/movie.mp4': 'file:///tmp/movie.mp4',
      });
      const cache = new Cache(storage, 'test-resource', 10);
      await cache.clean();

      const manager = new ResourceManager(cache);

      await manager.init();

      const uri = 'file:///tmp/wrong-file.mp4';

      // Trigger cache
      try {
        await manager.cacheMedia(uri);
        expect.fail('Should not reach this point');
      } catch (err) {
        expect((err as Error).message).to.be.eql('File not found');
      }

      // Get from cache
      try {
        await manager.getMedia(uri);
        expect.fail('Should not reach this point');
      } catch (err) {
        expect((err as Error).message).to.be.eql('File not found');
      }
    });

    it('should free space and try to store file is storage is full', async () => {});
  });
});
