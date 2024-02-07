import {
  StorageIntegration,
  StoreResult,
  StoreError,
} from '../src/storage.integration'

function byteLength(str: string) {
  return new TextEncoder().encode(str).length
}

export class StorageMockup implements StorageIntegration {
  files: { [index: string]: { url: string; size: number } } = {}

  constructor(private filesFixture: { [url: string]: string }) {}

  /**
   * Perform any initialization required by the cache.
   */
  async init() {}

  /**
   *
   */
  async info() {
    return {
      used: 0,
      total: 0,
    }
  }

  /**
   * List the files of the cache, if possible support pagination.
   */
  async listFiles() {
    return []
  }

  /**
   * Store a file on a given key. The file must be downloaded and
   * stored by the integration in the most efficient way for the
   * given platform.
   *
   * @param url
   */
  async storeFile(url: string) {
    const data = this.filesFixture[url]

    if (!data) {
      return {
        result: {
          code: StoreResult.Failure,
          error: StoreError.NotFound,
          errMsg: 'File not found',
        },
      }
    }

    const size = byteLength(data || '')
    this.files[url] = {
      url,
      size,
    }

    const blob = new Blob([data], { type: 'text/javascript' })

    return {
      item: {
        url: URL.createObjectURL(blob),
        size,
      },
      result: {
        code: StoreResult.Success,
      },
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
  async deleteFile(key: string) {
    delete this.files[key]
  }

  /**
   * Deletes all the files from the storage
   */
  async deleteAllFiles() {
    this.files = {}
  }

  async close() {}
}
