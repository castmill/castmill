import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLogicalSize } from '../../../../player/src/utils/logical-size';
import { Renderer } from '../../../../player/src/renderer';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('logical dimensions under device rotation', () => {
  it.each(['0', '90', '180', '270'])(
    'restores axes for %s degrees while retaining scale',
    (angle) => {
      const wrapper = document.createElement('div');
      wrapper.dataset.castmillOrientation = angle;
      const nested = document.createElement('div');
      const element = document.createElement('div');
      nested.appendChild(element);
      wrapper.appendChild(nested);
      document.body.appendChild(wrapper);
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 150,
        height: 300,
      } as DOMRect);
      expect(getLogicalSize(element)).toEqual(
        angle === '90' || angle === '270'
          ? { width: 300, height: 150 }
          : { width: 150, height: 300 }
      );
    }
  );

  it('preserves measurements outside a playback rotation wrapper', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 150,
    } as DOMRect);
    expect(getLogicalSize(element)).toEqual({ width: 300, height: 150 });
  });

  it('computes viewport clipping from the logical stage, not already scaled content', () => {
    const wrapper = document.createElement('div');
    wrapper.dataset.castmillOrientation = '90';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      width: 1920,
      height: 1080,
    } as DOMRect);
    const renderer = new Renderer(element);
    const viewport = { left: 0, top: 0, width: 50, height: 50 };
    renderer.setViewport(viewport);
    expect(element.style.width).toBe('200%');
    expect(JSON.parse(element.dataset.clip!)).toMatchObject({
      width: 1080,
      height: 1920,
    });
    renderer.setViewport(viewport);
    expect(JSON.parse(element.dataset.clip!)).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });
});
