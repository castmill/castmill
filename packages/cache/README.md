# Castmill Cache Package

This package provides a Cache and Resource Manager library that is used by the Castmill players to cache content and assets so that
they can reduce network usage and play content offline.

The cache is implemented using the [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) API
(via [Dexie](https://dexie.org/)), and a native storage layer that must be implemented for every platform.

## Integrations

To have a working cache, you must implement the (`StorageIntegration`)[./src/storage.integration.ts] interface. This interface provides the methods necessary for the cache to store the binary data on the device. Check in the (`integrations`)[./src/integrations] folder for examples of how to implement the interface for different platforms.

`MemoryCache` restores files with `sourceUrl` from native storage without IndexedDB. When a write reports `NOT_ENOUGH_SPACE` or the native API rejects with a recognized disk-full error, it evicts the oldest cached file and retries, at most once per evictable entry. Other write failures do not trigger eviction. During a forced refresh, the previous version of that URL is retained if the new write cannot be completed.

## Learn more

- Official website: https://castmill.com/
- Guides: coming soon.
- Docs: coming soon.

## License

This software is open source and is covered by the [AGPLv3 license](./LICENSE.md). If you require a different license for commercial
purposes, please get in touch with us.
