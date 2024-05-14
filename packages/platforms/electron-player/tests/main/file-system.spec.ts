import { StoreResult } from '@castmill/cache';
import { vi, describe, it, beforeAll, beforeEach, expect } from 'vitest';
import * as path from 'path';

import {
  initStorage,
  getStorageInfo,
  listFiles,
  storeFile,
  retrieveFile,
  deleteFile,
  deleteAllFiles,
} from '../../src/main/api/file-system';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve('test data')),
  mkdir: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])), // No files initially
  rename: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
  stat: vi.fn(() => Promise.resolve({ size: 9 })),
}));

import { readFile, writeFile, readdir, stat, unlink } from 'fs/promises';

describe('File System', () => {
  const testDir = 'test-dir';

  beforeEach(async () => {
    vi.resetAllMocks();
  });

  it('should store a file and return file details', async () => {
    stat.mockResolvedValueOnce({ size: 9 });
    const data = 'test data';
    const url = 'http://example.com/image.png';

    const result = await storeFile(testDir, url, data);

    expect(result.item.size).to.equal(9);
    expect(result.result.code).to.equal(StoreResult.Success);
    expect(writeFile).toHaveBeenCalled();
  });

  it('should retrieve a file path if file exists', async () => {
    const url = 'http://example.com/image.png';
    const filePath = await retrieveFile(testDir, url);

    expect(filePath).to.include(testDir);
  });

  it('should return undefined if file does not exist', async () => {
    stat.mockRejectedValueOnce(new Error('File not found'));
    const url = 'http://example.com/image.png';
    const filePath = await retrieveFile(testDir, url);

    expect(filePath).to.be.undefined;
  });

  it('should list files with details', async () => {
    readdir.mockResolvedValueOnce(['image.png']);
    stat.mockResolvedValueOnce({ size: 9 });

    const fileList = await listFiles(testDir);

    expect(fileList.length).to.equal(1);
    expect(fileList[0].size).to.equal(9);
  });

  it('should delete a file', async () => {
    unlink.mockResolvedValueOnce();
    const url = 'http://example.com/image.png';
    await deleteFile(testDir, url);

    expect(unlink).toHaveBeenCalled();
  });

  it('should delete all files in the directory', async () => {
    readdir.mockResolvedValueOnce(['image.png', 'image2.png']);
    unlink.mockResolvedValue();
    await deleteAllFiles(testDir);

    expect(unlink).toHaveBeenCalledTimes(2);
  });
});
