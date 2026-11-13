import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { useMediaQuery } from './useMediaQuery';
import { useWideLayout } from './useWideLayout';

type Listener = (event: MediaQueryListEvent) => void;

const mockMatchMedia = (initial: boolean, legacy = false) => {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: legacy
      ? undefined
      : vi.fn((_: string, cb: Listener) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: Listener) =>
      listeners.delete(cb)
    ),
    addListener: vi.fn((cb: Listener) => listeners.add(cb)),
    removeListener: vi.fn((cb: Listener) => listeners.delete(cb)),
  };
  window.matchMedia = vi.fn(() => mql) as any;
  return {
    mql,
    listeners,
    change: (matches: boolean) =>
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent)),
  };
};

const originalMatchMedia = window.matchMedia;
const originalResizeObserver = global.ResizeObserver;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  global.ResizeObserver = originalResizeObserver;
});

describe('useMediaQuery', () => {
  it('returns the fallback without matchMedia', () => {
    (window as any).matchMedia = undefined;
    createRoot((dispose) => {
      expect(useMediaQuery('(min-width: 1em)', true)()).toBe(true);
      expect(useMediaQuery('(min-width: 1em)', false)()).toBe(false);
      dispose();
    });
  });

  it('tracks changes and removes its listener on cleanup', () => {
    const media = mockMatchMedia(false);
    createRoot((dispose) => {
      const matches = useMediaQuery('(min-width: 64em)', true);
      expect(matches()).toBe(false);
      media.change(true);
      expect(matches()).toBe(true);
      dispose();
    });
    expect(media.mql.removeEventListener).toHaveBeenCalled();
    expect(media.listeners.size).toBe(0);
  });

  it('falls back to addListener on legacy browsers', () => {
    const media = mockMatchMedia(true, true);
    createRoot((dispose) => {
      const matches = useMediaQuery('(pointer: coarse)', false);
      expect(media.mql.addListener).toHaveBeenCalled();
      media.change(false);
      expect(matches()).toBe(false);
      dispose();
    });
    expect(media.mql.removeListener).toHaveBeenCalled();
  });
});

describe('useWideLayout', () => {
  let resize: () => void;
  let observer: { observe: any; disconnect: any };

  beforeEach(() => {
    observer = { observe: vi.fn(), disconnect: vi.fn() };
    global.ResizeObserver = vi.fn((cb: () => void) => {
      resize = cb;
      return observer;
    }) as any;
  });

  const container = (width: number, fontSize = '16px') => {
    const el = document.createElement('div');
    el.style.fontSize = fontSize;
    let current = width;
    el.getBoundingClientRect = () => ({ width: current }) as DOMRect;
    return { el, setWidth: (next: number) => (current = next) };
  };

  const setup = (options: Parameters<typeof useWideLayout>[0]) =>
    createRoot((dispose) => ({ layout: useWideLayout(options), dispose }));

  it('is wide only when the viewport and the container are wide enough', () => {
    const media = mockMatchMedia(true);
    const box = container(1000);
    const { layout, dispose } = setup({
      query: '(min-width: 64em)',
      minEm: 57,
    });
    layout.ref(box.el);
    expect(observer.observe).toHaveBeenCalledWith(box.el);
    expect(layout.wide()).toBe(true);
    expect(layout.narrow()).toBe(false);

    // Narrow drawer, e.g. a portrait tablet or zoomed page.
    box.setWidth(800);
    resize();
    expect(layout.wide()).toBe(false);

    // Hidden containers report 0 and keep the last decision.
    box.setWidth(0);
    resize();
    expect(layout.wide()).toBe(false);

    box.setWidth(1000);
    resize();
    expect(layout.wide()).toBe(true);

    // Phone viewport.
    media.change(false);
    expect(layout.narrow()).toBe(true);
    dispose();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('measures in em of the container font size', () => {
    mockMatchMedia(true);
    const box = container(570, '10px');
    const { layout, dispose } = setup({ query: 'q', minEm: 57 });
    layout.ref(box.el);
    expect(layout.wide()).toBe(true);
    box.setWidth(569);
    resize();
    expect(layout.wide()).toBe(false);
    dispose();
  });

  it('only uses the media query without minEm or ResizeObserver', () => {
    mockMatchMedia(true);
    const first = setup({ query: 'q' });
    first.layout.ref(container(10).el);
    expect(global.ResizeObserver).not.toHaveBeenCalled();
    expect(first.layout.wide()).toBe(true);
    first.dispose();

    (global as any).ResizeObserver = undefined;
    const second = setup({ query: 'q', minEm: 57 });
    second.layout.ref(container(10).el);
    expect(second.layout.wide()).toBe(true);
    second.dispose();
  });

  it('uses the fallback where matchMedia is unavailable', () => {
    (window as any).matchMedia = undefined;
    createRoot((dispose) => {
      expect(useWideLayout({ query: 'q', fallback: false }).wide()).toBe(false);
      expect(useWideLayout({ query: 'q' }).wide()).toBe(true);
      dispose();
    });
  });

  it('re-observes when the container changes', () => {
    mockMatchMedia(true);
    const { layout, dispose } = setup({ query: 'q', minEm: 10 });
    layout.ref(container(500).el);
    expect(layout.wide()).toBe(true);
    layout.ref(container(100).el);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(observer.observe).toHaveBeenCalledTimes(2);
    expect(layout.wide()).toBe(false);
    dispose();
  });
});
