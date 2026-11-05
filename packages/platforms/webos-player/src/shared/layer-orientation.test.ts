import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layer } from '../../../../player/src/layer';

const STAGE = { width: 1080, height: 1920 };

describe('aspect-ratio layer under device rotation without ResizeObserver', () => {
  let root: HTMLDivElement;
  let layer: Layer;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', undefined);
    root = document.createElement('div');
    document.body.appendChild(root);
    // A rotated logical box still occupies the physical stage on screen.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      STAGE as DOMRect
    );
  });

  afterEach(() => {
    layer?.unload();
    root.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const mountLayer = () => {
    layer = new Layer('rotated', { widgetAspectRatio: '16:9' });
    const widget = document.createElement('div');
    layer.el.appendChild(widget);
    root.appendChild(layer.el);
    return widget;
  };

  it.each([
    [0, 1080, 607.5],
    [90, 1920, 1080],
    [180, 1080, 607.5],
    [270, 1920, 1080],
  ])(
    'fits a 16:9 widget into logical dimensions at %i degrees',
    (next, width, height) => {
      root.dataset.castmillOrientation = String(next);
      const widget = mountLayer();

      window.dispatchEvent(new Event('resize'));

      expect(widget.style.width).toBe(`${width}px`);
      expect(widget.style.height).toBe(`${height}px`);
    }
  );

  it('re-measures logically when orientation changes live', () => {
    root.dataset.castmillOrientation = '0';
    const widget = mountLayer();
    window.dispatchEvent(new Event('resize'));
    expect(widget.style.width).toBe('1080px');

    root.dataset.castmillOrientation = '90';
    window.dispatchEvent(new Event('resize'));

    expect(widget.style.width).toBe('1920px');
    expect(widget.style.height).toBe('1080px');
  });
});
