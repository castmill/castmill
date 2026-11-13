import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'solid-js';
import {
  KEYBOARD_INSET_PROPERTY,
  KEYBOARD_OPEN_ATTRIBUTE,
  readKeyboardInset,
  trackKeyboardInset,
  useKeyboardInset,
} from './useKeyboardInset';

class FakeVisualViewport extends EventTarget {
  constructor(
    public width: number,
    public height: number,
    public offsetTop = 0,
    public scale = 1
  ) {
    super();
  }
}

const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');

const setViewport = (vv: FakeVisualViewport | undefined) =>
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: vv,
  });

const root = document.documentElement;

afterEach(() => {
  if (original) Object.defineProperty(window, 'visualViewport', original);
  else delete (window as { visualViewport?: unknown }).visualViewport;
  root.style.removeProperty(KEYBOARD_INSET_PROPERTY);
  root.removeAttribute(KEYBOARD_OPEN_ATTRIBUTE);
});

describe('readKeyboardInset', () => {
  it('is 0 without visualViewport support', () => {
    setViewport(undefined);
    expect(readKeyboardInset()).toBe(0);
  });

  it('is 0 when the viewports match', () => {
    setViewport(new FakeVisualViewport(window.innerWidth, window.innerHeight));
    expect(readKeyboardInset()).toBe(0);
  });

  it('measures the area hidden below the visual viewport', () => {
    setViewport(
      new FakeVisualViewport(window.innerWidth, window.innerHeight - 300, 20)
    );
    expect(readKeyboardInset()).toBe(280);
  });

  it('ignores small changes such as collapsing browser toolbars', () => {
    setViewport(
      new FakeVisualViewport(window.innerWidth, window.innerHeight - 50)
    );
    expect(readKeyboardInset()).toBe(0);
  });

  it('ignores pinch zoom', () => {
    setViewport(
      new FakeVisualViewport(
        window.innerWidth / 2,
        window.innerHeight / 2,
        0,
        2
      )
    );
    expect(readKeyboardInset()).toBe(0);
  });
});

describe('trackKeyboardInset', () => {
  it('publishes the inset and open state, and clears them on stop', () => {
    const vv = new FakeVisualViewport(window.innerWidth, window.innerHeight);
    setViewport(vv);
    const seen: number[] = [];
    const stop = trackKeyboardInset(root, (inset) => seen.push(inset));

    expect(root.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('');
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(false);

    vv.height = window.innerHeight - 320;
    vv.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('320px');
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(true);

    // Scrolling the visual viewport without a size change is not re-reported.
    vv.dispatchEvent(new Event('scroll'));

    vv.height = window.innerHeight;
    vv.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('');
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(false);
    expect(seen).toEqual([0, 320, 0]);

    vv.height = window.innerHeight - 320;
    vv.dispatchEvent(new Event('resize'));
    stop();
    expect(root.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('');
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(false);

    // Listeners are removed.
    vv.dispatchEvent(new Event('resize'));
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(false);
  });

  it('is a no-op without visualViewport support', () => {
    setViewport(undefined);
    const stop = trackKeyboardInset();
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(false);
    expect(() => stop()).not.toThrow();
  });
});

describe('useKeyboardInset', () => {
  it('tracks the keyboard while mounted', () => {
    const vv = new FakeVisualViewport(window.innerWidth, window.innerHeight);
    setViewport(vv);
    const { inset, dispose } = createRoot((dispose) => ({
      inset: useKeyboardInset(),
      dispose,
    }));
    expect(inset()).toBe(0);

    vv.height = window.innerHeight - 250;
    vv.dispatchEvent(new Event('resize'));
    expect(inset()).toBe(250);
    expect(root.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('250px');

    dispose();
    expect(root.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('');
  });

  it('accepts a custom target element', () => {
    const vv = new FakeVisualViewport(
      window.innerWidth,
      window.innerHeight - 200
    );
    setViewport(vv);
    const el = document.createElement('div');
    const dispose = createRoot((dispose) => {
      useKeyboardInset(el);
      return dispose;
    });
    expect(el.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe('200px');
    expect(root.hasAttribute(KEYBOARD_OPEN_ATTRIBUTE)).toBe(false);
    dispose();
  });
});
