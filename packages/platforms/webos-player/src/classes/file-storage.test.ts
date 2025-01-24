import {
  vi,
  describe,
  it,
  beforeAll,
  beforeEach,
  expect,
  MockedFunction,
} from 'vitest';
import { FileStorage } from './file-storage';

vi.mock('../native/native-api', () => ({
  storage: {
    writeFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve('test data')),
    mkdir: vi.fn(() => Promise.resolve()),
    listFiles: vi.fn(() => Promise.resolve([])), // No files initially
    moveFile: vi.fn(() => Promise.resolve()),
    removeFile: vi.fn(() => Promise.resolve()),
    statFile: vi.fn(() => Promise.resolve({ size: 9 })),
    copyFile: vi.fn(() => Promise.resolve()),
  },
}));

import { storage as api } from '../native/native-api';

describe('FileStorage', () => {
  const testDir = 'file://internal/castmill-cache';
  const cacheBasePath = 'http://127.0.0.1:9080/castmill-cache';
  let storage;
  beforeEach(async () => {
    storage = new FileStorage(testDir);
    await storage.init();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should retrieve a file path if file exists', async () => {
    const url = 'http://example.com/image.png';
    const filePath = await storage.retrieveFile(url);

    expect(filePath).to.include(cacheBasePath);
  });

  it('should return undefined if file does not exist', async () => {
    vi.mocked(api.statFile).mockRejectedValueOnce(new Error('File not found'));
    const url = 'http://example.com/image.png';
    const filePath = await storage.retrieveFile(url);

    expect(filePath).to.be.undefined;
  });

  it('should list files with details', async () => {
    vi.mocked(api.listFiles).mockResolvedValueOnce({
      files: [
        {
          name: 'image.png',
          size: 9,
        },
      ],
    });

    const fileList = await storage.listFiles();

    expect(fileList.length).to.equal(1);
    expect(fileList[0].size).to.equal(9);
  });

  it('should delete a file', async () => {
    vi.mocked(api.removeFile).mockResolvedValueOnce();
    const url = 'http://example.com/image.png';
    await storage.deleteFile(testDir, url);

    expect(api.removeFile).toHaveBeenCalled();
  });

  it('should delete all files in the directory', async () => {
    await storage.deleteAllFiles(testDir);

    expect(api.removeFile).toHaveBeenCalledWith({
      file: testDir,
      recursive: true,
    });
  });

  describe('Downloading', () => {
    it('should download a file from a URL and write it to the file system', async () => {
      vi.mocked(api.statFile).mockResolvedValueOnce({ size: 0 });
      const url = 'http://example.com/image.png';
      const result = await storage.storeFile(url);

      expect(result.result.code).to.equal('SUCCESS');
      expect(api.copyFile).toHaveBeenCalledOnce();
      expect(api.moveFile).toHaveBeenCalledOnce();
    });

    it('should return error if data cannot be downloaded', async () => {
      vi.mocked(api.copyFile).mockRejectedValueOnce(
        new Error('Failed to download file')
      );
      const url = 'http://example.com/image.png';
      const result = await storage.storeFile(url);

      expect(result.result.code).to.equal('FAILURE');
    });
  });
});
