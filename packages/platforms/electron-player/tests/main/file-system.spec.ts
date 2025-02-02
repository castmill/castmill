import { vi, describe, it, beforeEach, expect } from 'vitest';
import { StoreOptions } from '@castmill/cache';

import {
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

vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({ write: vi.fn(() => {}) })),
}));

vi.mock('electron', () => ({
  net: {
    request: vi.fn(() => ({})),
  },
}));

import { writeFile, readdir, stat, unlink } from 'fs/promises';
import { createWriteStream, Dirent, Stats, WriteStream } from 'fs';
import { net, ClientRequest } from 'electron';

describe('File System', () => {
  const testDir = 'test-dir';

  beforeEach(async () => {
    vi.resetAllMocks();
  });

  it('should retrieve a file path if file exists', async () => {
    const url = 'http://example.com/image.png';
    const filePath = await retrieveFile(testDir, url);

    expect(filePath).to.include(testDir);
  });

  it('should return undefined if file does not exist', async () => {
    vi.mocked(stat).mockRejectedValueOnce(new Error('File not found'));
    const url = 'http://example.com/image.png';
    const filePath = await retrieveFile(testDir, url);

    expect(filePath).to.equal(undefined);
  });

  it('should list files with details', async () => {
    vi.mocked(readdir).mockResolvedValueOnce([
      'image.png',
    ] as unknown as Dirent[]);
    vi.mocked(stat).mockResolvedValueOnce({ size: 9 } as unknown as Stats);

    const fileList = await listFiles(testDir);

    expect(fileList.length).to.equal(1);
    expect(fileList[0].size).to.equal(9);
  });

  it('should delete a file', async () => {
    vi.mocked(unlink).mockResolvedValueOnce();
    const url = 'http://example.com/image.png';
    await deleteFile(testDir, url);

    expect(unlink).toHaveBeenCalled();
  });

  it('should delete all files in the directory', async () => {
    vi.mocked(readdir).mockResolvedValueOnce([
      'image.png',
      'image2.png',
    ] as unknown as Dirent[]);
    vi.mocked(unlink).mockResolvedValue();
    await deleteAllFiles(testDir);

    expect(unlink).toHaveBeenCalledTimes(2);
  });

  describe('Downloading', () => {
    it('should download a file from a URL and write it to the file system', async () => {
      vi.mocked(stat).mockResolvedValueOnce({ size: 9 } as unknown as Stats);
      const writeStream = {
        write: vi.fn(() => {}),
        on: vi.fn(() => {}),
        end: vi.fn(),
      } as unknown as WriteStream;
      vi.mocked(createWriteStream).mockImplementationOnce(() => writeStream);
      vi.mocked(net.request).mockImplementationOnce(() => {
        return {
          on: (event: string, cb: (response) => void) => {
            if (event === 'response') {
              cb({
                statusCode: 200,
                on: (event: string, cb: (response: string) => void) => {
                  switch (event) {
                    case 'data':
                      cb('test data');
                      break;
                    case 'end':
                      cb('ok');
                      break;
                  }
                },
              });
            }
          },
          end: () => {},
        } as unknown as ClientRequest;
      });

      const url = 'http://example.com/image.png';
      const result = await storeFile(testDir, url);

      expect(result.result.code).to.equal('SUCCESS');
      expect(writeStream.write).toHaveBeenCalledWith('test data');
      expect(writeStream.end).toHaveBeenCalledOnce();
    });

    it('should return error if data cannot be stored', async () => {
      vi.mocked(writeFile).mockRejectedValueOnce(
        new Error('Failed to store file')
      );
      const opts: StoreOptions = {
        headers: {
          Authorization: 'Bearer token',
        },
      };
      const url = 'http://example.com/image.png';

      const result = await storeFile(testDir, url, opts);

      expect(result.result.code).to.equal('FAILURE');
      expect(unlink).toHaveBeenCalledOnce();
    });

    it('should return error if download fails due to 404', async () => {
      vi.mocked(createWriteStream).mockImplementationOnce(
        () =>
          ({
            write: vi.fn(() => {}),
            on: () => {},
          }) as unknown as WriteStream
      );
      vi.mocked(net.request).mockImplementationOnce(() => {
        return {
          on: (event: string, cb: (response) => void) => {
            if (event === 'response') {
              cb({
                statusCode: 404,
                on: () => {},
              });
            }
          },
          end: () => {},
        } as unknown as ClientRequest;
      });

      const url = 'http://example.com/image.png';

      const result = await storeFile(testDir, url);

      expect(result.result.code).to.equal('FAILURE');
    });

    it('should return error if response emits an eror', async () => {
      const writeStream = {
        write: vi.fn(),
        on: vi.fn(() => {}),
        end: vi.fn(),
      } as unknown as WriteStream;
      vi.mocked(createWriteStream).mockImplementationOnce(() => writeStream);
      vi.mocked(net.request).mockImplementationOnce(() => {
        return {
          on: (event: string, cb: (response) => void) => {
            if (event === 'response') {
              cb({
                statusCode: 200,
                on: (event: string, cb: (response: string) => void) => {
                  switch (event) {
                    case 'error':
                      cb('Failed to download file');
                      break;
                  }
                },
              });
            }
          },
          end: vi.fn(),
        } as unknown as ClientRequest;
      });

      const url = 'http://example.com/image.png';
      const result = await storeFile(testDir, url);

      expect(result.result.code).to.equal('FAILURE');
      expect(writeStream.end).toHaveBeenCalled();
    });

    it('should return error if file cannot be written', async () => {
      vi.mocked(createWriteStream).mockImplementationOnce(
        () =>
          ({
            write: vi.fn(() => {}),
            on: (event: string, cb: (response: string) => void) => {
              if (event === 'error') {
                cb('Failed to write file');
              }
            },
          }) as unknown as WriteStream
      );
      vi.mocked(net.request).mockImplementationOnce(() => {
        return {
          on: (event: string, cb: (response) => void) => {
            if (event === 'response') {
              cb({
                statusCode: 200,
                on: () => {},
              });
            }
          },
          end: () => {},
        } as unknown as ClientRequest;
      });

      const url = 'http://example.com/image.png';

      const result = await storeFile(testDir, url);

      expect(result.result.code).to.equal('FAILURE');
    });
  });
});
