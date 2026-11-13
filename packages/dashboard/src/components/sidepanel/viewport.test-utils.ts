/**
 * Test helper: a controllable `window.matchMedia` that understands the
 * `(max-width: Nem)` and `(hover: none), (pointer: coarse)` queries used by
 * the responsive app shell.
 */
import { vi } from 'vitest';

interface Viewport {
  widthEm: number;
  touch?: boolean;
}

type Listener = (event: MediaQueryListEvent) => void;

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
  let viewport = initial;
  const queries: { query: string; listeners: Set<Listener> }[] = [];

  window.matchMedia = vi.fn((query: string) => {
    const entry = { query, listeners: new Set<Listener>() };
    queries.push(entry);
    return {
      get matches() {
        return evaluate(query, viewport);
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: Listener) =>
        entry.listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) =>
        entry.listeners.delete(listener),
      addListener: (listener: Listener) => entry.listeners.add(listener),
      removeListener: (listener: Listener) => entry.listeners.delete(listener),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  });

  return {
    /** Changes the viewport and notifies every registered query listener. */
    resize(next: Viewport) {
      viewport = next;
      for (const entry of queries) {
        const matches = evaluate(entry.query, viewport);
        entry.listeners.forEach((listener) =>
          listener({ matches, media: entry.query } as MediaQueryListEvent)
        );
      }
    },
  };
};
