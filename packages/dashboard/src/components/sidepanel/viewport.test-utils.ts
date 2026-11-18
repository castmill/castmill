/**
 * Test helper: a controllable `window.matchMedia` that understands the
 * `(max-width: Nem)` and `(hover: none), (pointer: coarse)` queries used by
 * the responsive app shell.
 */
import { mockMatchMedia } from '@castmill/ui-common/testing';

interface Viewport {
  widthEm: number;
  touch?: boolean;
}

const evaluate = (query: string, viewport: Viewport) => {
  if (query.includes('pointer: coarse')) return !!viewport.touch;
  const maxWidth = query.match(/max-width:\s*([\d.]+)em/);
  return maxWidth ? viewport.widthEm <= parseFloat(maxWidth[1]) : false;
};

export const PHONE: Viewport = { widthEm: 375 / 16, touch: true };
export const TABLET_PORTRAIT: Viewport = { widthEm: 768 / 16, touch: true };
export const TABLET_LANDSCAPE: Viewport = { widthEm: 1024 / 16, touch: true };
export const DESKTOP: Viewport = { widthEm: 1440 / 16 };

export const mockViewport = (initial: Viewport) => {
  const media = mockMatchMedia((query) => evaluate(query, initial));
  return {
    /** Changes the viewport and notifies the affected query listeners. */
    resize(next: Viewport) {
      media.set((query) => evaluate(query, next));
    },
  };
};
