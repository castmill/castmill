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
  setWebosOrientation,
} from './api';

describe('WebOS wrapper bridge', () => {
  it.each([0, 90, 180, 270] as const)(
    'sends numeric %i to the existing setRotation operation',
    async (angle) => {
      const post = vi
        .spyOn(window.parent, 'postMessage')
        .mockImplementation(() => {});
      try {
        const pending = setWebosOrientation(angle);
        const request = JSON.parse(post.mock.calls[0][0] as string);
        expect(request.fn).toBe('setRotation');
        expect(request.args).toEqual([angle]);
        window.dispatchEvent(
          new MessageEvent('message', {
            data: JSON.stringify({ ack: true, guid: request.guid }),
          })
        );
        await pending;
      } finally {
        post.mockRestore();
      }
    }
  );

  it('rejects a wrapper error', async () => {
    const post = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});
    try {
      const pending = setWebosOrientation(90);
      const request = JSON.parse(post.mock.calls[0][0] as string);
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({
            ack: true,
            guid: request.guid,
            err: { message: 'native denied' },
          }),
        })
      );
      await expect(pending).rejects.toEqual({ message: 'native denied' });
    } finally {
      post.mockRestore();
    }
  });

  it('reports an old wrapper missing setRotation instead of claiming CSS success', async () => {
    const post = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});
    try {
      const pending = setWebosOrientation(270);
      const request = JSON.parse(post.mock.calls[0][0] as string);
      const error = { message: 'MSG: function "setRotation" not implemented' };
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ ack: true, guid: request.guid, err: error }),
        })
      );
      await expect(pending).rejects.toEqual(error);
    } finally {
      post.mockRestore();
    }
  });

  it('cleans up the deadline when posting to the wrapper fails', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const post = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {
        throw new Error('post failed');
      });
    try {
      await expect(setWebosOrientation(90)).rejects.toThrow('post failed');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      post.mockRestore();
      vi.useRealTimers();
    }
  });

  it('rejects an unresponsive wrapper and ignores its late acknowledgement', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const post = vi
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {});
    try {
      const pending = expect(setWebosOrientation(180)).rejects.toThrow(
        'setRotation timed out'
      );
      const request = JSON.parse(post.mock.calls[0][0] as string);
      await vi.advanceTimersByTimeAsync(10_000);
      await pending;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ ack: true, guid: request.guid }),
        })
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      post.mockRestore();
      vi.useRealTimers();
    }
  });
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
