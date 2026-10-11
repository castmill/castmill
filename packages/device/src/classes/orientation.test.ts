import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Machine, Orientation } from '../interfaces/machine';
import { isOrientation } from '../interfaces/machine';
import { OrientationManager } from './orientation';

describe('device orientation', () => {
  let manager: OrientationManager;
  let machine: Pick<Machine, 'getSetting' | 'setSetting' | 'setOrientation'>;

  beforeEach(() => {
    machine = {
      getSetting: vi.fn().mockResolvedValue(null),
      setSetting: vi.fn().mockResolvedValue(undefined),
    };
    manager = new OrientationManager(machine as Machine);
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', undefined);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1920,
      height: 1080,
    } as DOMRect);
  });

  afterEach(() => {
    manager.dispose();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const mount = () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const element = manager.attach(root);
    return {
      element,
      wrapper: element.parentElement!,
      stage: element.parentElement!.parentElement!,
    };
  };

  it.each([0, 90, 180, 270] as const)(
    'validates and renders %i degrees',
    async (angle) => {
      expect(isOrientation(angle)).toBe(true);
      const { element, wrapper } = mount();
      const video = document.createElement('video');
      element.appendChild(video);
      const result = await manager.apply(angle);
      expect(result.mode).toBe('css');
      expect(wrapper.dataset.castmillOrientation).toBe(String(angle));
      expect(wrapper.style.transform).toBe(
        `translate(-50%, -50%) rotate(${angle}deg)`
      );
      expect(wrapper.style.width).toBe(
        angle === 90 || angle === 270 ? '1080px' : '1920px'
      );
      expect(wrapper.style.height).toBe(
        angle === 90 || angle === 270 ? '1920px' : '1080px'
      );
      expect(element.firstElementChild).toBe(video);
      expect(machine.setSetting).toHaveBeenCalledWith(
        'ORIENTATION',
        String(angle)
      );
    }
  );

  it.each([-90, 45, 360, '90', null, undefined, true, NaN])(
    'rejects invalid input %s',
    async (value) => {
      expect(isOrientation(value)).toBe(false);
      await expect(manager.apply(value as Orientation)).rejects.toThrow(
        'Invalid device orientation'
      );
      expect(machine.setSetting).not.toHaveBeenCalled();
    }
  );

  it('keeps the default without a saved preference', async () => {
    await manager.restore();
    const { wrapper } = mount();
    expect(wrapper.dataset.castmillOrientation).toBe('0');
    expect(machine.setSetting).not.toHaveBeenCalled();
  });

  it.each(['0', '90', '180', '270'])('restores persisted %s', async (value) => {
    vi.mocked(machine.getSetting).mockResolvedValue(value);
    await manager.restore();
    expect(mount().wrapper.dataset.castmillOrientation).toBe(value);
  });

  it.each(['', '090', '360', '90.0', 'bad'])(
    'reports corrupt storage %s',
    async (value) => {
      vi.mocked(machine.getSetting).mockResolvedValue(value);
      await expect(manager.restore()).rejects.toThrow('Invalid stored');
      expect(machine.setSetting).not.toHaveBeenCalled();
    }
  );

  it('does not hide storage read errors', async () => {
    vi.mocked(machine.getSetting).mockRejectedValue(new Error('read failed'));
    await expect(manager.restore()).rejects.toThrow('read failed');
  });

  it('avoids duplicate native operations and double rotation', async () => {
    machine.setOrientation = vi.fn().mockResolvedValue({ mode: 'native' });
    const { wrapper } = mount();
    await manager.apply(90);
    await manager.apply(90);
    expect(machine.setOrientation).toHaveBeenCalledTimes(1);
    expect(wrapper.dataset.castmillOrientation).toBe('0');
    expect(wrapper.style.width).toBe('1920px');
  });

  it('uses explicit platform CSS fallback', async () => {
    machine.setOrientation = vi.fn().mockResolvedValue({ mode: 'css' });
    await manager.apply(270);
    expect(mount().wrapper.dataset.castmillOrientation).toBe('270');
  });

  it('serializes rapid changes, with the latest preference winning', async () => {
    let release!: () => void;
    machine.setOrientation = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ mode: 'css' });
          })
      )
      .mockResolvedValue({ mode: 'css' });
    const first = manager.apply(90);
    const second = manager.apply(180);
    await Promise.resolve();
    expect(machine.setOrientation).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second, manager.ready()]);
    expect(mount().wrapper.dataset.castmillOrientation).toBe('180');
  });

  it('reports native failures and keeps the queue usable', async () => {
    machine.setOrientation = vi
      .fn()
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValue({ mode: 'css' });
    await expect(manager.apply(90)).rejects.toThrow('permission denied');
    expect(machine.setSetting).not.toHaveBeenCalled();
    await manager.apply(180);
    expect(mount().wrapper.dataset.castmillOrientation).toBe('180');
  });

  it('rejects invalid platform results', async () => {
    machine.setOrientation = vi.fn().mockResolvedValue({ mode: 'invalid' });
    await expect(manager.apply(90)).rejects.toThrow('Invalid native');
  });

  it('retries after a persistence failure rather than claiming success', async () => {
    vi.mocked(machine.setSetting).mockRejectedValueOnce(
      new Error('write failed')
    );
    await expect(manager.apply(90)).rejects.toThrow('write failed');
    await manager.apply(90);
    expect(machine.setSetting).toHaveBeenCalledTimes(2);
  });

  it('recomputes sizing on resize and fullscreen changes without recursion', async () => {
    const { wrapper } = mount();
    await manager.apply(270);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      width: 800,
      height: 1200,
    } as DOMRect);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(wrapper.style.width).toBe('1200px');
    expect(wrapper.style.height).toBe('800px');
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(500);
    expect(wrapper.style.width).toBe('1200px');
  });

  it('uses ResizeObserver when present and releases every listener/wrapper', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
      }
    );
    const resized = vi.fn();
    manager = new OrientationManager(machine as Machine, resized);
    const { element, stage } = mount();
    expect(observe).toHaveBeenCalledWith(stage);
    expect(resized).toHaveBeenCalledOnce();
    manager.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(element.parentElement).toBe(stage);
    expect(vi.getTimerCount()).toBe(0);
    manager.dispose();
  });

  it('supports detached playback roots and reattachment', () => {
    const root = document.createElement('div');
    manager.attach(root);
    manager.attach(root);
    expect(root.querySelectorAll('[data-castmill-orientation]')).toHaveLength(
      1
    );
  });
});
