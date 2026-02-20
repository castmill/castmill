import type {
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
  StoreOptions,
} from '@castmill/cache';

import { createHash } from 'crypto';
import { mkdir, readdir, unlink, stat, rename } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join, extname } from 'path';
import { URL } from 'url';
import { net } from 'electron';
import { LOCAL_URL_SCHEME, CACHE_DIR } from '../constants';

const LOCAL_URL_PREFIX = `${LOCAL_URL_SCHEME}://`;

// Only works with CommonJS require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const checkDiskSpace = require('check-disk-space').default;

const BASE_DIR = join(__dirname, CACHE_DIR);

function getTempPath(path: string): string {
  return `${path}-${Date.now()}.tmp`;
}

/*
 * Initialize storage
 */
export async function initStorage(storagePath: string): Promise<void> {
  const fullPath = join(BASE_DIR, storagePath);
  try {
    await mkdir(fullPath, { recursive: true });
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    throw error;
  }
}

/*
 * Get storage info. Returns the used and total available storage space.
 * We never use more than 50% of the total available space to leave space
 * for updates etc.
 */
export async function getStorageInfo(
  storagePath: string
): Promise<StorageInfo> {
  const fullPath = join(BASE_DIR, storagePath);
  try {
    const files = await readdir(fullPath);
    let used = 0;
    for (const file of files) {
      const stats = await stat(join(fullPath, file));
      used += stats.size;
    }
    const total = (await getFreeDiskSpace(fullPath)) + used * 0.5;
    return { used, total };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    throw error;
  }
}

/*
 * List all files in the storage
 *
 * Returns an array of objects with the local file URL and size
 */
export async function listFiles(storagePath: string): Promise<StorageItem[]> {
  const fullPath = join(BASE_DIR, storagePath);
  try {
    const files = await readdir(fullPath);
    return Promise.all(
      files
        .filter((file) => !file.endsWith('.tmp')) // Exclude temporary files
        .map(async (file) => {
          const filePath = join(fullPath, file);
          const stats = await stat(filePath);
          const localUrl = getLocalUrlForFile(storagePath, file);
          return {
            url: localUrl,
            size: stats.size,
          };
        })
    );
  } catch (error) {
    console.error('Failed to list files:', error);
    throw error;
  }
}

/*
 * Store a file in the storage.
 *
 * Returns a StoreFileReturnValue object with the result code and the stored local file path
 */
export async function storeFile(
  storagePath: string,
  url: string,
  opts?: StoreOptions
): Promise<StoreFileReturnValue> {
  const fullPath = join(BASE_DIR, storagePath);

  try {
    const filename = getFileName(url);

    const filePath = join(fullPath, filename);
    const tempPath = getTempPath(filePath);

    try {
      await downloadFile(tempPath, mapLocalhostUrl(url), opts);

      // Atomically rename the file to its final name
      await rename(tempPath, filePath);
    } catch (error) {
      console.error('Failed to store file:', error);

      // Delete the temporary file if it exists
      await deleteFileIfExists(tempPath);

      throw error;
    }
    const stats = await stat(filePath);
    const localUrl = getLocalUrl(storagePath, url);
    return {
      result: { code: 'SUCCESS' },
      item: {
        url: localUrl,
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
export async function retrieveFile(
  storagePath: string,
  url: string
): Promise<string | void> {
  try {
    const localPath = getLocalPath(storagePath, url);
    await stat(localPath); // Check if file exists
    return getLocalUrl(storagePath, url);
  } catch (error) {
    console.error('Failed to retrieve file:', error);
    return undefined; // File does not exist
  }
}

/*
 * Delete a file from the storage
 */
export async function deleteFile(
  storagePath: string,
  url: string
): Promise<void> {
  const localPath = getLocalPath(storagePath, url);
  await deleteFileIfExists(localPath);
}

async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      // File does not exist, nothing to do
      return;
    }

    console.error('Failed to delete file:', error);
    throw error;
  }
}

/*
 * Delete all files from the storage
 */
export async function deleteAllFiles(storagePath: string): Promise<void> {
  const fullPath = join(BASE_DIR, storagePath);
  try {
    const files = await readdir(fullPath);
    await Promise.all(files.map((file) => unlink(join(fullPath, file))));
  } catch (error) {
    console.error('Failed to delete all files:', error);
  }
}

/*
 * Download a file from the URL and save it to the destination path
 */
function downloadFile(
  destPath: string,
  url: string,
  opts?: StoreOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      headers: opts?.headers,
    });
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        console.error(
          `Failed to download file, status code: ${response.statusCode}`
        );
        return reject(
          Error(`Failed to download file, status code: ${response.statusCode}`)
        );
      }
      const writeStream = createWriteStream(destPath);
      response.on('data', (chunk) => {
        writeStream.write(chunk);
      });
      response.on('end', () => {
        writeStream.end();
      });
      writeStream.on('finish', () => {
        return resolve(destPath);
      });
      response.on('error', (error) => {
        console.error('Failed to download file:', error);
        writeStream.end();
        return reject(error);
      });
      writeStream.on('error', (error) => {
        console.error('Failed to write file:', error);
        return reject(error);
      });
    });
    request.on('error', (error) => {
      console.error('Failed to make request:', error);
      return reject(error);
    });
    request.end();
  });
}

/*
 * Get the free disk space in bytes
 */
async function getFreeDiskSpace(path) {
  const { free } = await checkDiskSpace(path);
  return free;
}

/*
 * Generate a unique file name based on the URL. Keep the extension if present.
 */
function getFileName(url: string): string {
  const pathName = new URL(url).pathname;
  const extension = extname(pathName);

  const hash = createHash('sha256').update(pathName).digest('hex');
  // extension includes the dot if present. Empty string if no extension
  return `${hash}${extension}`;
}

/**
 * Get the local path of a downloaded file.
 * Both remote URLs and local URLs are supported.
 *
 * Example:
 * getLocalPath('http://abc.com/test/file1.txt') =>
 *  '/home/user/castmill/castmill-electron-file-storage/123455.txt'
 * getLocalPath('local://123455.txt') =>
 *  '/home/user/castmill/castmill-electron-file-storage/123455.txt'
 */
function getLocalPath(storagePath: string, url: string): string {
  if (url.startsWith('http')) {
    const filename = getFileName(url);
    return join(BASE_DIR, storagePath, filename);
  } else if (url.startsWith(LOCAL_URL_PREFIX)) {
    const filename = url.split(LOCAL_URL_PREFIX)[1];
    return join(BASE_DIR, storagePath, filename);
  } else {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * Get the local URL of a file
 *
 * Example:
 *  getLocalUrl('12355.txt') =>
 *    'local://storage-path/12355.txt'
 */
function getLocalUrlForFile(storagePath: string, filename: string): string {
  return `${LOCAL_URL_PREFIX}${join(storagePath, filename)}`;
}

/**
 * Get the local URL of a remote url
 *
 * Example:
 *  getLocalUrl('http://test/file1.txt') =>
 *    'local://12355.txt'
 */
function getLocalUrl(storagePath: string, remoteUrl: string): string {
  const filename = getFileName(remoteUrl);
  return getLocalUrlForFile(storagePath, filename);
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
