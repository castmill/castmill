import { Accessor, createSignal, onCleanup } from 'solid-js';

/**
 * Shared layout breakpoints (em). SCSS `@media` rules use the same values
 * as literals; keep them in sync.
 */
export const BREAKPOINTS_EM = {
  /** Phones: stacked cards, compact toolbars, bottom sheets. */
  phone: 36,
  /** Phones and portrait tablets: off-canvas navigation, compact top bar. */
  tablet: 48,
  /** Desktops and landscape tablets: side-by-side details layouts. */
  wide: 64,
} as const;

/** Viewport query for phone layouts (compact toolbars, tree panels, etc.). */
export const PHONE_LAYOUT_QUERY = `(max-width: ${BREAKPOINTS_EM.phone}em)`;
/** Viewport query for phones and portrait tablets. */
export const TABLET_LAYOUT_QUERY = `(max-width: ${BREAKPOINTS_EM.tablet}em)`;
/** Viewport query for wide (side-by-side) layouts. */
export const WIDE_LAYOUT_QUERY = `(min-width: ${BREAKPOINTS_EM.wide}em)`;
/** Touch screens without a precise pointer. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * One-off `matchMedia` check for event handlers that decide at interaction
 * time. Returns `false` where matchMedia is not available.
 */
export const matchesMediaQuery = (query: string): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(query).matches;

/**
 * Reactive `matchMedia` signal. Returns `fallback` when matchMedia is not
 * available (e.g. in jsdom).
 */
export function useMediaQuery(
  query: string,
  fallback: boolean
): Accessor<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return () => fallback;

  const mql = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mql.matches);
  const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

  if (mql.addEventListener) {
    mql.addEventListener('change', onChange);
    onCleanup(() => mql.removeEventListener('change', onChange));
  } else {
    // Chrome 38 era browsers only expose the deprecated listener API.
    mql.addListener(onChange);
    onCleanup(() => mql.removeListener(onChange));
  }

  return matches;
}

/** Reactive phone-layout signal; `false` where matchMedia is unavailable. */
export function usePhoneLayout(): Accessor<boolean> {
  return useMediaQuery(PHONE_LAYOUT_QUERY, false);
}

/** Reactive coarse-pointer (touch) signal; `false` without matchMedia. */
export function useCoarsePointer(): Accessor<boolean> {
  return useMediaQuery(COARSE_POINTER_QUERY, false);
}
