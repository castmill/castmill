/**
 * Test helper: replaces `window.matchMedia` with a controllable stub.
 *
 * Kept free of test-runner imports so it can ship as the
 * `@castmill/ui-common/testing` entry point for dashboard and addon tests.
 */

/**
 * Which queries match: `true`/`false` for every query, a list of exact
 * query strings, or a predicate.
 */
export type MediaMatcher =
  | boolean
  | readonly string[]
  | ((query: string) => boolean);

type Listener = (event: MediaQueryListEvent) => void;

export interface MatchMediaMock {
  /** Changes which queries match and notifies listeners whose result changed. */
  set(matcher: MediaMatcher): void;
  /** Restores the `window.matchMedia` that was installed before the mock. */
  restore(): void;
  /** Every query passed to `matchMedia` so far. */
  readonly queries: string[];
}

const toPredicate = (matcher: MediaMatcher) =>
  typeof matcher === 'function'
    ? matcher
    : typeof matcher === 'boolean'
      ? () => matcher
      : (query: string) => matcher.includes(query);

export const mockMatchMedia = (matcher: MediaMatcher): MatchMediaMock => {
  const original = window.matchMedia;
  let matches = toPredicate(matcher);
  const lists: { query: string; last: boolean; listeners: Set<Listener> }[] =
    [];
  const queries: string[] = [];

  window.matchMedia = ((query: string) => {
    const entry = {
      query,
      last: matches(query),
      listeners: new Set<Listener>(),
    };
    lists.push(entry);
    queries.push(query);
    return {
      get matches() {
        return matches(query);
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
  }) as typeof window.matchMedia;

  return {
    queries,
    set(next) {
      matches = toPredicate(next);
      for (const entry of lists) {
        const now = matches(entry.query);
        if (now === entry.last) continue;
        entry.last = now;
        entry.listeners.forEach((listener) =>
          listener({ matches: now, media: entry.query } as MediaQueryListEvent)
        );
      }
    },
    restore() {
      window.matchMedia = original;
    },
  };
};
