import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvironment } from './api';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Electron environment bridge', () => {
  const environment = {
    deviceId: 'electron-device',
    versionStr: 'Castmill-Electron-1.0.0',
    model: 'Electron',
  };

  const setup = () => {
    const wrapper = document.createElement('iframe');
    document.body.append(wrapper);
    const parent = wrapper.contentWindow!;
    vi.stubGlobal('parent', parent);
    const postMessage = vi
      .spyOn(parent, 'postMessage')
      .mockImplementation(() => {});
    return { wrapper, parent, postMessage };
  };

  it('ignores unrelated messages while waiting for the parent environment', async () => {
    const { wrapper, parent, postMessage } = setup();
    try {
      const pending = getEnvironment();
      for (const data of [
        'console',
        'null',
        '{}',
        JSON.stringify({ ...environment, versionStr: 123 }),
        environment,
      ]) {
        window.dispatchEvent(
          new MessageEvent('message', {
            data,
            source: parent,
            origin: 'app://.',
          })
        );
      }
      const remove = vi.spyOn(window, 'removeEventListener');
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify(environment),
          source: parent,
          origin: 'app://.',
        })
      );

      await expect(pending).resolves.toEqual(environment);
      expect(postMessage).toHaveBeenCalledWith('getEnvironment', '*');
      expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    } finally {
      wrapper.remove();
    }
  });

  it('ignores environment data from another frame', async () => {
    const { wrapper, parent } = setup();
    try {
      const pending = getEnvironment();
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ ...environment, deviceId: 'other-device' }),
          source: window,
          origin: 'app://.',
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify(environment),
          source: parent,
          origin: 'app://.',
        })
      );

      await expect(pending).resolves.toEqual(environment);
    } finally {
      wrapper.remove();
    }
  });

  it('times out and removes the listener when the wrapper does not respond', async () => {
    vi.useFakeTimers();
    const { wrapper } = setup();
    const remove = vi.spyOn(window, 'removeEventListener');
    try {
      const pending = getEnvironment();
      const rejected = expect(pending).rejects.toThrow(
        'environment request timed out'
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await rejected;
      expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    } finally {
      wrapper.remove();
    }
  });

  it('cleans up when sending to the wrapper throws', async () => {
    const { wrapper, postMessage } = setup();
    const remove = vi.spyOn(window, 'removeEventListener');
    postMessage.mockImplementation(() => {
      throw new Error('Wrapper unavailable');
    });
    try {
      await expect(getEnvironment()).rejects.toThrow('Wrapper unavailable');
      expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
    } finally {
      wrapper.remove();
    }
  });

  it('rejects when called outside an iframe', async () => {
    vi.stubGlobal('parent', window);
    await expect(getEnvironment()).rejects.toThrow(
      'getEnvironment can only be called from an iframe'
    );
  });
});
