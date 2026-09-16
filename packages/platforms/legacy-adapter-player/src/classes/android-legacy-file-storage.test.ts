import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AndroidLegacyFileStorage } from './android-legacy-file-storage';

vi.mock('../android-legacy-api', () => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  downloadFile: vi
    .fn()
    .mockImplementation(
      async (_url: string, localPath: string) =>
        `content://com.castmill.files/${localPath}`
    ),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  deletePath: vi.fn().mockResolvedValue(undefined),
}));

import {
  deleteFile,
  downloadFile,
  getItem,
  setItem,
} from '../android-legacy-api';

describe('AndroidLegacyFileStorage', () => {
  let storage: AndroidLegacyFileStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    storage = new AndroidLegacyFileStorage('');
    await storage.init();
  });

  it('uses a new local URI when the same source URL is rewritten', async () => {
    const url = 'https://castmill.example/devices/1/channels';

    const first = await storage.storeFile(url);
    const second = await storage.storeFile(url);

    expect(first.item?.url).not.toBe(second.item?.url);
    expect(downloadFile).toHaveBeenCalledTimes(2);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
  });

  it('deletes a superseded local URI without removing the current mapping', async () => {
    const url = 'https://castmill.example/devices/1/channels';
    const first = await storage.storeFile(url);
    const second = await storage.storeFile(url);

    await storage.deleteFile(first.item!.url);

    expect(deleteFile).toHaveBeenCalledWith(first.item!.url);
    expect(await storage.retrieveFile(url)).toBe(second.item?.url);
  });

  it('deletes the native file and mapping when given its source URL', async () => {
    const url = 'https://castmill.example/media/image.png';
    const stored = await storage.storeFile(url);

    await storage.deleteFile(url);

    expect(deleteFile).toHaveBeenCalledWith(stored.item!.url);
    expect(await storage.retrieveFile(url)).toBeUndefined();
    expect(setItem).toHaveBeenLastCalledWith('FILE_MAP', '[]');
    expect(getItem).toHaveBeenCalledWith('FILE_MAP');
  });
});
