import type {
  StorageInfo,
  StorageItem,
  StoreFileReturnValue,
} from '@castmill/cache';

import { createHash } from 'crypto';
import { writeFile, mkdir, readdir, unlink, stat, rename } from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { URL } from 'url';
import { net } from 'electron';
import os from 'os';

// Only works with CommonJS require
const checkDiskSpace = require('check-disk-space').default;

// Get home directory
const homeDir = os.homedir();

// Base directory for storage
const BASE_DIR = join(homeDir, 'castmill-electron-file-storage');

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
          return {
            url: filePath,
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
 * Store a file in the storage. If data is provided, it is used as the file
 * content. Otherwise, the file is downloaded from the URL.
 */
export async function storeFile(
  storagePath: string,
  url: string,
  data = null
): Promise<StoreFileReturnValue> {
  const fullPath = join(BASE_DIR, storagePath);

  try {
    const filename = getFileName(url);

    const filePath = join(fullPath, filename);
    const tempPath = filePath + '.tmp';

    try {
      if (data) {
        await writeFile(tempPath, data);
      } else {
        await downloadFile(tempPath, url);
      }

      // Atomically rename the file to its final name
      await rename(tempPath, filePath);
    } catch (error) {
      console.error('Failed to store file:', error);

      // Delete the temporary file if it exists
      await unlink(tempPath);

      throw error;
    }
    const stats = await stat(filePath);
    return {
      result: { code: 'SUCCESS' },
      item: {
        url: filePath,
        size: stats.size,
      },
    };
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
  const fullPath = join(BASE_DIR, storagePath);
  try {
    const filePath = join(fullPath, getFileName(url));
    await stat(filePath); // Check if file exists
    return filePath;
  } catch (error) {
    console.log('Failed to retrieve file:', error);
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
  const fullPath = join(BASE_DIR, storagePath);
  try {
    const filePath = join(fullPath, getFileName(url));
    await unlink(filePath);
  } catch (error) {
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
function downloadFile(destPath: string, url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
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
    request.end();
  });
}

/*
 * Generate a unique file name based on the URL. Keep the extension if present.
 * @param {string} url - The URL of the file
 * @returns {string} - The unique file name
 */
function getFileName(url: string): string {
  const pathName = new URL(url).pathname;
  const extension = pathName.split('.').pop();

  const hash = createHash('sha256').update(pathName).digest('hex');
  // if extension is present, append it to the hash otherwise, just return the hash
  return extension ? `${hash}.${extension}` : hash;
}

/*
 * Get the free disk space in bytes
 */
async function getFreeDiskSpace(path) {
  const { free } = await checkDiskSpace(path);
  return free;
}
