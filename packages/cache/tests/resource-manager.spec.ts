import 'fake-indexeddb/auto';

import { describe, it } from 'mocha';

import { ResourceManager } from '../src/resource-manager';
import { Cache } from '../src/cache';
import { StorageMockup } from './storage.mockup';
import { expect } from 'chai';

describe('ResourceManager', () => {
  describe('code resources', () => {
    it('should trigger refresh callback if code has been updated', async () => {
      const uri = 'https://app.castmill.com/static/js/doohv2/app.js';

      const storage1 = new StorageMockup({
        [uri]: 'export const a = 1;',
      });
      const cache1 = new Cache(storage1, 'test-resource', 10);
      const manager1 = new ResourceManager(cache1);

      await manager1.init();

      // Trigger cache
      const result1 = await manager1.import(uri);
      expect(result1).to.be.undefined;

      manager1.close();

      const storage2 = new StorageMockup({
        [uri]: 'export const a = 2;',
      });

      const cache2 = new Cache(storage2, 'test-resource', 10);

      await new Promise<void>(async (resolve) => {
        const manager2 = new ResourceManager(cache2, {
          needsRefresh: () => {
            resolve();
          },
        });

        await manager2.init();

        // Trigger cache
        const result2 = await manager2.import(uri);
        expect(result2).to.be.undefined;

        manager2.close();
      });
    });

    it('should cache code resources', async () => {
      const storage = new StorageMockup({
        'https://example.com/code.js': 'export const a = 1;',
      });
      const cache = new Cache(storage, 'test-resource', 10);
      const manager = new ResourceManager(cache);

      await manager.init();

      const uri = 'https://example.com/code.js';

      // Trigger cache
      const result = await manager.import(uri);
      expect(result).to.be.undefined;

      // Get from cache
      const { a } = await manager.import(uri);
      expect(a).to.be.eql(1);
    });
  });

  describe('data resources', () => {
    it('should get new data if freshness has expired', async () => {});

    it('should cache data resources', async () => {
      const uri = 'https://example.com/data.json';

      const storage = new StorageMockup({
        [uri]: ' { "foo": "bar" } ',
      });

      const cache = new Cache(storage, 'test-data-resource', 10);
      const manager = new ResourceManager(cache);

      await manager.init();

      // Trigger cache
      const result = await manager.getData(uri, 5000);
      expect(result).to.be.undefined;

      // Get from cache
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
      const result = await manager.getMedia(uri);
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
      const manager = new ResourceManager(cache);

      await manager.init();

      const uri = 'file:///tmp/wrong-file.mp4';

      // Trigger cache
      const result = await manager.getMedia(uri);
      expect(result).to.be.undefined;

      // Get from cache
      const media = await manager.getMedia(uri);
      expect(media).to.be.undefined;
    });

    it('should free space and try to store file is storage is full', async () => {});
  });
});
