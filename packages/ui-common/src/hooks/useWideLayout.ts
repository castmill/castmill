import { Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { useMediaQuery } from './useMediaQuery';

export interface WideLayoutOptions {
  /** Viewport media query that must match for the wide layout. */
  query: string;
  /**
   * Minimum container width (in em of the container's font size) for the
   * wide layout. Covers tablets, zoomed pages and narrow drawers where the
   * viewport is wide but the container is not.
   */
  minEm?: number;
  /** Value used where matchMedia is unavailable (e.g. jsdom). */
  fallback?: boolean;
}

export interface WideLayout {
  /** Ref callback for the container whose width is measured. */
  ref: (el: HTMLElement | undefined) => void;
  wide: Accessor<boolean>;
  narrow: Accessor<boolean>;
}

/**
 * Responsive `wide`/`narrow` switch for details views: the layout is wide
 * when the viewport matches `query` and the measured container is at least
 * `minEm` wide. Without ResizeObserver only the media query is used.
 */
export function useWideLayout(options: WideLayoutOptions): WideLayout {
  const wideViewport = useMediaQuery(options.query, options.fallback ?? true);
  const [container, setContainer] = createSignal<HTMLElement>();
  const [fits, setFits] = createSignal(true);

  createEffect(() => {
    const el = container();
    const minEm = options.minEm;
    if (!el || !minEm || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const width = el.getBoundingClientRect().width;
      // Hidden or detached containers report 0; keep the last decision.
      if (!width) return;
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
      setFits(width >= minEm * fontSize);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    onCleanup(() => observer.disconnect());
  });

  const wide = () => wideViewport() && fits();
  return { ref: setContainer, wide, narrow: () => !wide() };
}
