import { describe, it, expect, afterEach } from 'vitest';
import { createRoot } from 'solid-js';
import { useVisualViewportBox } from './useVisualViewportBox';

class FakeVisualViewport extends EventTarget {
  constructor(
    public width: number,
    public height: number,
    public offsetLeft = 0,
    public offsetTop = 0
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

afterEach(() => {
  if (original) Object.defineProperty(window, 'visualViewport', original);
  else delete (window as { visualViewport?: unknown }).visualViewport;
});

describe('useVisualViewportBox', () => {
  it('returns undefined without visualViewport support', () => {
    setViewport(undefined);
    createRoot((dispose) => {
      expect(useVisualViewportBox()()).toBeUndefined();
      dispose();
    });
  });

  it('returns undefined when the viewports match', () => {
    setViewport(new FakeVisualViewport(window.innerWidth, window.innerHeight));
    createRoot((dispose) => {
      expect(useVisualViewportBox()()).toBeUndefined();
      dispose();
    });
  });

  it('pins to the visible area and follows panning', () => {
    const vv = new FakeVisualViewport(390, 600, 733, 0);
    setViewport(vv);
    const { box, dispose } = createRoot((dispose) => ({
      box: useVisualViewportBox(),
      dispose,
    }));
    expect(box()).toMatchObject({
      left: '733px',
      top: '0px',
      width: '390px',
      height: '600px',
    });

    vv.offsetLeft = 100;
    vv.offsetTop = 40;
    vv.dispatchEvent(new Event('scroll'));
    expect(box()).toMatchObject({ left: '100px', top: '40px' });
    dispose();
  });
});
