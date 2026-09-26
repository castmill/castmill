import { describe, expect, it, vi } from 'vitest';
import {
  clearWebosFiles,
  fetchWebosFile,
  getWebosMachineGUID,
  initWebosLegacyApi,
  rebootWebosDevice,
  removeWebosFile,
  restartWebosApp,
  updateWebosPlayer,
} from './api';

describe('WebOS wrapper bridge', () => {
  it('requests the hardware ID using the wrapper protocol', async () => {
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});

    try {
      initWebosLegacyApi();
      const idPromise = getWebosMachineGUID();
      expect(postMessage).toHaveBeenCalledOnce();

      const [message, targetOrigin] = postMessage.mock.calls[0];
      const request = JSON.parse(message as string);
      expect(targetOrigin).toBe('*');
      expect(request.fn).toBe('getUUid');
      expect(request.args).toEqual([]);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({
            ack: true,
            guid: request.guid,
            msg: 'stable-webos-id',
          }),
        })
      );
      expect(await idPromise).toBe('stable-webos-id');
    } finally {
      postMessage.mockRestore();
    }
  });

  it('calls native file operations with the wrapper protocol', async () => {
    const postMessage = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});
    const call = async <T>(
      action: () => Promise<T>,
      fn: string,
      args: unknown[],
      result?: T
    ): Promise<T> => {
      const pending = action();
      const [message] = postMessage.mock.calls.at(-1)!;
      const request = JSON.parse(message as string);
      expect(request.fn).toBe(fn);
      expect(request.args).toEqual(args);
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ ack: true, guid: request.guid, msg: result }),
        })
      );
      return pending;
    };

    try {
      const source = 'https://castmill.test/medias/1/poster.mp4';
      const stored = {
        url: 'http://127.0.0.1:9080/castmill-cache/abc.mp4',
        size: 42,
      };
      expect(
        await call(() => fetchWebosFile(source), 'fetchFile', [source], stored)
      ).toEqual(stored);
      const file = 'file://internal/castmill-cache/abc.mp4';
      await call(() => removeWebosFile(file), 'storage_removeFile', [{ file }]);
      await call(() => clearWebosFiles(), 'clearFiles', []);
      await call(() => restartWebosApp(), 'restart', []);
      await call(() => rebootWebosDevice(), 'reboot', []);
      await call(() => updateWebosPlayer(), 'updatePlayer', []);
    } finally {
      postMessage.mockRestore();
    }
  });
});
