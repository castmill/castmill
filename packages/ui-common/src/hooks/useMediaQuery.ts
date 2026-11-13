import { Accessor, createSignal, onCleanup } from 'solid-js';

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

/** Viewport query for phone layouts (compact toolbars, tree panels, etc.). */
export const PHONE_LAYOUT_QUERY = '(max-width: 36em)';

/** Reactive phone-layout signal; `false` where matchMedia is unavailable. */
export function usePhoneLayout(): Accessor<boolean> {
  return useMediaQuery(PHONE_LAYOUT_QUERY, false);
}
