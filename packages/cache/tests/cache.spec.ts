/// <reference types="node" />

import 'fake-indexeddb/auto'

import { describe, it } from 'mocha'
import { expect } from 'chai'

import { Cache, ItemType } from '../src/cache'
import { StorageMockup } from './storage.mockup'

describe('Cache', () => {
  it('should return undefined for a non-cached item', async () => {
    const storage = new StorageMockup({})
    const cache = new Cache(storage, 'test', 10)

    const item = await cache.get('some-url')
    expect(item).to.be.undefined
  })

  it('should return cached item', async () => {
    const url = 'https://example.com/code.js'
    const storage = new StorageMockup({
      'https://example.com/code.js': 'const a = 1;',
    })
    const cache = new Cache(storage, 'test', 10)

    await cache.set(url, ItemType.Code, 'text/javascript')

    const item = await cache.get(url)

    expect(item).to.have.property('url', url)
    expect(item).to.have.property('type', ItemType.Code)
    expect(item).to.have.property('accessed', 1)
    expect(item).to.have.property('mimeType', 'text/javascript')
    expect(item).to.have.property('size', 12)
  })

  it('should list cached items', async () => {
    const url = 'https://example.com/code.js'

    const filesFixture: { [index: string]: string } = {}
    for (let i = 0; i < 10; i++) {
      filesFixture[`${url}${i}`] = 'const a = 1;'
    }

    const storage = new StorageMockup(filesFixture)
    const cache = new Cache(storage, 'test-items', 10)

    for (let i = 0; i < 10; i++) {
      await cache.set(`${url}${i}`, ItemType.Code, 'text/javascript')
    }

    const items = await cache.list(ItemType.Code)
    expect(items).to.have.length(10)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      expect(item).to.have.property('url', `${url}${i}`)
      expect(item).to.have.property('type', ItemType.Code)
      expect(item).to.have.property('accessed', 0)
      expect(item).to.have.property('mimeType', 'text/javascript')
      expect(item).to.have.property('size', 12)
    }
  })

  it('should delete cached items', async () => {
    const url = 'https://example.com/data'

    const filesFixture: { [index: string]: string } = {}
    for (let i = 0; i < 10; i++) {
      filesFixture[`${url}${i}`] = '{ "foo" : "bar" }'
    }

    const storage = new StorageMockup(filesFixture)
    const cache = new Cache(storage, 'test-delete', 10)

    for (let i = 0; i < 10; i++) {
      await cache.set(`${url}${i}`, ItemType.Data, 'application/json')
    }

    await cache.del(`${url}3`)

    const items = await cache.list(ItemType.Data)
    expect(items).to.have.length(9)
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      expect(item).to.have.property(
        'url',
        i < 3 ? `${url}${i}` : `${url}${i + 1}`
      )
      expect(item).to.have.property('type', 'data')
      expect(item).to.have.property('accessed', 0)
      expect(item).to.have.property('mimeType', 'application/json')
      expect(item).to.have.property('size', 17)
    }
  })

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
    const url = 'https://example.com/code.js'
    const storage = new StorageMockup({
      [url]: 'const a = 1;',
    })
    const cache = new Cache(storage, 'test-access', 10)

    await cache.set(url, ItemType.Code, 'text/javascript')

    for (let i = 1; i < 42; i++) {
      const item = await cache.get(url)
      expect(item).to.have.property('accessed', i)
      // expect(item).to.have.property("timestamp", 1); // we need fake timers to test for timestamps
    }
  })

  it('should remove older cached items if the cache is full (maxItems)', async () => {
    const url = 'https://example.com/code.js'
    const filesFixture: { [index: string]: string } = {}
    for (let i = 0; i < 13; i++) {
      filesFixture[`${url}${i}`] = 'const a = 1;'
    }

    const storage = new StorageMockup(filesFixture)
    const cache = new Cache(storage, 'test-max-items', 10)

    for (let i = 0; i < 10; i++) {
      await cache.set(`${url}${i}`, ItemType.Code, 'text/javascript')
    }

    expect(await cache.list(ItemType.Code)).to.have.length(10)

    await cache.set(`${url}10`, ItemType.Code, 'text/javascript')
    await cache.set(`${url}11`, ItemType.Code, 'text/javascript')
    await cache.set(`${url}12`, ItemType.Code, 'text/javascript')

    const items = await cache.list(ItemType.Code)

    expect(items).to.have.length(10)
    const removed = [`${url}0`, `${url}1`, `${url}2`]
    for (let i = 0; i < items.length; i++) {
      expect(items[i].url).to.not.be.oneOf(removed)
    }
  })
  it('should remove older cached items if the cache is full (maxSize)', () => {})
  it('should not download the same file again if already in the process of caching', () => {})

  it('should clear the cache', async () => {})
})
