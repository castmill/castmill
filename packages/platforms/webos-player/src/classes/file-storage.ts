import {
  StorageIntegration,
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
  StoreOptions,
} from '@castmill/cache';
import { storage } from '../native';
import { simpleHash } from './utils';

const CACHE_DIR = 'castmill-cache';

// The path to use when accessing the local files using the storage api
const CACHE_PATH = `file://internal/${CACHE_DIR}`;

// The path to use when accessing the local files from the web app
const EXTERNAL_PATH = `http://127.0.0.1:9080/${CACHE_DIR}`;

function getLocalUrl(path: string): string {
  return `${CACHE_PATH}/${path}`;
}

function getExternalUrl(path: string): string {
  return `${EXTERNAL_PATH}/${path}`;
}

function getTempPath(path: string): string {
  return `${path}-${Date.now()}.tmp`;
}

export class FileStorage implements StorageIntegration {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    return storage.mkdir({ path: CACHE_PATH });
  }

  async info(): Promise<StorageInfo> {
    try {
      const { files } = await storage.listFiles({ path: CACHE_PATH });
      const used = files.reduce((acc, file) => acc + (file.size ?? 0), 0);
      const total = ((await storage.getStorageInfo()).free + used) * 0.5;
      return { used, total };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      throw error;
    }
  }

  async listFiles(): Promise<StorageItem[]> {
    const { files } = await storage.listFiles({ path: CACHE_PATH });

    return files
      .filter((file): file is { name: string; size: number } => !!file.name)
      .filter(({ name }) => !name.endsWith('.tmp'))
      .map((file) => ({
        url: getExternalUrl(file.name),
        size: file.size ?? 0,
      }));
  }

  async storeFile(
    url: string,
    opts?: StoreOptions
  ): Promise<StoreFileReturnValue> {
    try {
      const filename = getFileName(url);

      const filePath = getLocalUrl(filename);
      const externalUrl = getExternalUrl(filename);
      const tempPath = getTempPath(filePath);

      try {
        await storage.copyFile({
          source: mapLocalhostUrl(url),
          destination: tempPath,
          httpOption: {
            headers: opts?.headers,
          },
        });

        // Atomically rename the file to its final name
        await storage.moveFile({ oldPath: tempPath, newPath: filePath });
      } catch (error) {
        console.error('Failed to store file:', error);

        // Delete the temporary file if it exists
        await storage.removeFile({ file: tempPath });

        throw error;
      }
      const stats = await storage.statFile({ path: filePath });

      return {
        result: { code: 'SUCCESS' },
        item: {
          url: externalUrl,
          size: stats.size,
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to store file:', error);
      const errMsg = error?.message ?? 'Unknown Error';
      return {
        result: { code: 'FAILURE', errMsg },
      };
    }
  }

  /*
   * Retrieve a file from the storage. Returns the file path if the file exists,
   */
  async retrieveFile(url: string): Promise<string | void> {
    try {
      const filePath = getExternalUrl(getFileName(url));
      await storage.statFile({ path: filePath }); // Check if file exists
      return filePath;
    } catch (error) {
      console.error('Failed to retrieve file:', error);
      return undefined; // File does not exist
    }
  }

  /*
   * Delete a file from the storage
   */
  async deleteFile(url: string): Promise<void> {
    const filePath = getLocalPath(url);

    try {
      await storage.removeFile({
        file: filePath,
        recursive: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.errorCode === 'IO_ERROR') {
        // File does not exist, nothing to delete
        console.warn('File does not exist:', filePath);
        return;
      }
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  /*
   * Delete all files from the storage
   */
  async deleteAllFiles(): Promise<void> {
    return storage.removeFile({
      file: CACHE_PATH,
      recursive: true,
    });
  }

  async close(): Promise<void> {
    // NOOP on WebOS
  }
}

/*
 * Generate a unique file name based on the URL. Keep the extension if present.
 * @param {string} url - The URL of the file
 * @returns {string} - The unique file name
 */
function getFileName(url: string): string {
  const pathName = new URL(url).pathname;

  const [, extension] = pathName.split('.');

  const hash = simpleHash(pathName);
  // if extension is present, append it to the hash otherwise, just return the hash
  return extension ? `${hash}.${extension}` : `${hash}`;
}

/**
 * Get the local path of a downloaded file.
 * Both remote URLs and local URLs are supported.
 *
 * Example:
 * getLocalPath('http://abc.com/test/file1.txt') =>
 *  'file://internal/castmill-cache/123455.txt'
 * getLocalPath('file://internal/castmill-cache/123455.txt') =>
 *  'file://internal/castmill-cache/123455.txt'
 * getLocalPath('http://127.0.0.1:9080/castmill-cache/123455.txt') =>
 *  'file://internal/castmill-cache/123455.txt'
 */
function getLocalPath(url: string): string {
  if (url.startsWith(EXTERNAL_PATH)) {
    const pathName = new URL(url).pathname.split('/').pop() ?? '';

    return getLocalUrl(pathName);
  } else if (url.startsWith('http')) {
    const filename = getFileName(url);
    return getLocalUrl(filename);
  } else if (url.startsWith(CACHE_PATH)) {
    return url;
  } else {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Map localhost url to remote url. Used when server is running on localhost.
 * @param {string} url - The URL to map
 * @returns {string} - The mapped URL
 */
function mapLocalhostUrl(url: string): string {
  const fileHost = import.meta.env.VITE_FILE_HOST;

  if (!fileHost) {
    return url;
  }

  return url.replace('localhost', fileHost);
}
