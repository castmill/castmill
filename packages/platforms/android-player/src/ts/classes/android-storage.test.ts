import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { AndroidStorage } from './android-storage';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    stat: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    deleteFile: vi.fn(),
    writeFile: vi.fn(),
    downloadFile: vi.fn(),
    rename: vi.fn(),
    getUri: vi.fn(),
  },
  Directory: {
    Documents: 'DOCUMENTS',
  },
}));

vi.mock('@capacitor/device', () => ({
  Device: {
    getInfo: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    convertFileSrc: vi.fn(),
  },
}));

describe('AndroidStorage', () => {
  const testDir = 'test-storage';
  let storage: AndroidStorage;

  beforeEach(async () => {
    storage = new AndroidStorage(testDir);
    await storage.init();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return storage info with used and total space', async () => {
    vi.mocked(Filesystem.readdir).mockResolvedValueOnce({
      files: [
        {
          name: 'file1.txt',
          size: 100,
          type: 'file',
          mtime: Date.now(),
          uri: 'file://test/file1.txt',
        },
        {
          name: 'file2.txt',
          size: 200,
          type: 'file',
          mtime: Date.now(),
          uri: 'file://test/file2.txt',
        },
      ],
    });
    vi.mocked(Device.getInfo).mockResolvedValueOnce({
      diskFree: 500000,
      model: 'Test Model',
      platform: 'android',
      operatingSystem: 'android',
      osVersion: '10.0',
      manufacturer: 'Test Manufacturer',
      isVirtual: false,
      webViewVersion: '1.0', // why need this?
    });

    const info = await storage.info();
    expect(info.used).toBe(300);
    expect(info.total).toBeGreaterThan(500000);
  });

  it('should store a file and return its details', async () => {
    const data = 'test data';
    const url = 'http://example.com/image.png';
    const fileName = 'hashed-filename.png';

    vi.mocked(Filesystem.stat).mockResolvedValueOnce({
      type: 'file',
      size: data.length,
      mtime: Date.now(),
      uri: 'file://test/filepath',
    });
    vi.mocked(Filesystem.writeFile).mockResolvedValueOnce({
      uri: 'file://test/filepath',
    });
    vi.mocked(Filesystem.getUri).mockResolvedValueOnce({
      uri: 'file://test/filepath',
    });
    vi.mocked(Capacitor.convertFileSrc).mockReturnValue('converted-file-url');
    vi.spyOn(storage, 'getFileName').mockResolvedValue(fileName);

    const result = await storage.storeFile(url, data);
    expect(result.result.code).toBe('SUCCESS');
    expect(result.item.url).toBe('converted-file-url');
    expect(result.item.size).toBe(data.length);
  });

  it('should retrieve a file path if the file exists', async () => {
    const url = 'http://example.com/image.png';
    const fileName = 'hashed-filename.png';

    vi.spyOn(storage, 'getFileName').mockResolvedValue(fileName);
    vi.mocked(Filesystem.stat).mockResolvedValueOnce({
      type: 'file',
      size: 100,
      mtime: Date.now(),
      uri: 'file://test/file1.txt',
    });

    const filePath = await storage.retrieveFile(url);
    expect(filePath).toContain(testDir);
    expect(filePath).toContain(fileName);
  });

  it('should return undefined if file does not exist', async () => {
    const url = 'http://example.com/image.png';
    const fileName = 'hashed-filename.png';

    vi.spyOn(storage, 'getFileName').mockResolvedValue(fileName);
    vi.mocked(Filesystem.stat).mockRejectedValueOnce(
      new Error('File not found')
    );

    const filePath = await storage.retrieveFile(url);
    expect(filePath).toBeUndefined();
  });

  it('should delete a file if it exists', async () => {
    const url = 'http://example.com/image.png';
    const fileName = 'hashed-filename.png';

    vi.spyOn(storage, 'getFileName').mockResolvedValue(fileName);
    vi.mocked(Filesystem.deleteFile).mockResolvedValueOnce();

    await storage.deleteFile(url);
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({
      path: `${testDir}/${fileName}`,
      directory: Directory.Documents,
    });
  });

  it('should throw an error when deleteFile fails', async () => {
    const url = 'http://example.com/image.png';
    const fileName = 'hashed-filename.png';

    vi.spyOn(storage, 'getFileName').mockResolvedValue(fileName);
    vi.mocked(Filesystem.deleteFile).mockRejectedValueOnce(
      new Error('Delete failed')
    );

    await expect(storage.deleteFile(url)).rejects.toThrow('Delete failed');
    expect(Filesystem.deleteFile).toHaveBeenCalled();
  });

  it('should delete all files in the directory', async () => {
    vi.mocked(Filesystem.readdir).mockResolvedValueOnce({
      files: [
        {
          name: 'file1.txt',
          size: 100,
          type: 'file',
          mtime: Date.now(),
          uri: 'file://test/file1.txt',
        },
        {
          name: 'file2.txt',
          size: 200,
          type: 'file',
          mtime: Date.now(),
          uri: 'file://test/file2.txt',
        },
      ],
    });

    await storage.deleteAllFiles();
    expect(Filesystem.deleteFile).toHaveBeenCalledTimes(2);
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({
      path: `${testDir}/file1.txt`,
      directory: Directory.Documents,
    });
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({
      path: `${testDir}/file2.txt`,
      directory: Directory.Documents,
    });
  });

  it('should handle renaming a file', async () => {
    const oldPath = `${testDir}/old-file.txt`;
    const newPath = `${testDir}/new-file.txt`;

    vi.mocked(Filesystem.rename).mockResolvedValueOnce();
    vi.mocked(Filesystem.deleteFile).mockResolvedValueOnce();

    await storage.rename(oldPath, newPath);
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({
      path: newPath,
      directory: Directory.Documents,
    });
    expect(Filesystem.rename).toHaveBeenCalledWith({
      from: oldPath,
      to: newPath,
      directory: Directory.Documents,
    });
  });

  it('should handle file download and store it', async () => {
    const url = 'http://example.com/file.png';
    const tempPath = `${testDir}/hashed-file-${Date.now()}.tmp`;

    vi.spyOn(storage, 'getFileName').mockResolvedValue('hashed-file.png');
    vi.spyOn(storage, 'getTempPath').mockReturnValue(tempPath);
    vi.mocked(Filesystem.downloadFile).mockResolvedValueOnce({
      path: tempPath,
    });
    vi.mocked(Filesystem.rename).mockResolvedValueOnce();
    vi.mocked(Filesystem.stat).mockResolvedValueOnce({
      size: 100,
      type: 'file',
      mtime: Date.now(),
      uri: 'file://test/hashed-file.png',
    });
    vi.mocked(Filesystem.getUri).mockResolvedValueOnce({
      uri: 'file://test/hashed-file.png',
    });
    vi.mocked(Capacitor.convertFileSrc).mockReturnValue('converted-file-url');

    const result = await storage.storeFile(url);
    expect(result.result.code).toBe('SUCCESS');
    expect(result.item.url).toBe('converted-file-url');
    expect(result.item.size).toBe(100);
    expect(Filesystem.downloadFile).toHaveBeenCalledWith({
      path: tempPath,
      url,
      directory: Directory.Documents,
      recursive: true,
    });
    expect(Filesystem.rename).toHaveBeenCalledWith({
      from: tempPath,
      to: `${testDir}/hashed-file.png`,
      directory: Directory.Documents,
    });
  });

  it('should handle file download failure and return FAILURE', async () => {
    const url = 'http://example.com/file.png';
    const tempPath = `${testDir}/hashed-file-${Date.now()}.tmp`;

    vi.spyOn(storage, 'getFileName').mockResolvedValue('hashed-file.png');
    vi.spyOn(storage, 'getTempPath').mockReturnValue(tempPath);
    vi.mocked(Filesystem.downloadFile).mockRejectedValueOnce(
      new Error('Download error')
    );

    const result = await storage.storeFile(url);
    expect(result.result.code).toBe('FAILURE');
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({
      path: tempPath,
      directory: Directory.Documents,
    });
  });
});
