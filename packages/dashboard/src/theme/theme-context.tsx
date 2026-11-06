/**
 * Theme (light/dark mode) context for the Dashboard.
 *
 * - The active theme is written to `<html data-theme="...">`; all colours come
 *   from the `--cm-*` tokens in ./theme.scss.
 * - The choice is cached in localStorage (applied before first paint by the
 *   boot script in index.html) and persisted to the user's server-side
 *   preferences so it follows the user across devices.
 * - Switching themes cross-fades between the old and new appearance.
 */

import {
  Accessor,
  JSX,
  createContext,
  createEffect,
  createSignal,
  on,
  useContext,
} from 'solid-js';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'castmill_theme';
export const DEFAULT_THEME: Theme = 'dark';
export const THEME_TRANSITION_MS = 450;

export const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark';

const readStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

const storeTheme = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable (private mode); the theme still applies.
  }
};

/**
 * Initial theme: stored choice, otherwise the OS preference, otherwise dark.
 */
export function getInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) {
    return stored;
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
    return 'light';
  }

  return DEFAULT_THEME;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let transitionTimer: ReturnType<typeof setTimeout> | undefined;
let themeApplicationRevision = 0;

/**
 * Applies a theme to the document, optionally with a fade animation.
 */
export function applyTheme(theme: Theme, animate = false) {
  const revision = ++themeApplicationRevision;
  const root = document.documentElement;
  if (root.dataset.theme === theme) {
    return;
  }

  const update = () => {
    if (revision === themeApplicationRevision) {
      root.dataset.theme = theme;
    }
  };

  if (!animate || prefersReducedMotion()) {
    update();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };

  if (typeof doc.startViewTransition === 'function') {
    // Cross-fades a snapshot of the old theme into the new one.
    doc.startViewTransition(update);
    return;
  }

  // Fallback: transition colours on every element for a short while.
  root.classList.add('theme-transitioning');
  update();
  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(
    () => root.classList.remove('theme-transitioning'),
    THEME_TRANSITION_MS
  );
}

export interface ThemePreferencesApi {
  load: (userId: string) => Promise<{ theme?: string } | undefined>;
  save: (userId: string, theme: Theme) => Promise<unknown>;
}

interface ThemeContextValue {
  theme: Accessor<Theme>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>();

export function ThemeProvider(props: {
  children: JSX.Element;
  /** Id of the signed-in user, used to sync with server preferences. */
  userId?: Accessor<string | undefined>;
  preferences?: ThemePreferencesApi;
  onChange?: (theme: Theme) => void;
}) {
  const [theme, setThemeSignal] = createSignal<Theme>(getInitialTheme());
  applyTheme(theme());
  props.onChange?.(theme());

  let themeChangeRevision = 0;
  let preferenceSaveQueue: Promise<unknown> = Promise.resolve();

  const set = (next: Theme, { animate = true, persist = true } = {}) => {
    if (!isTheme(next)) {
      return;
    }
    if (persist) {
      themeChangeRevision += 1;
    }

    storeTheme(next);
    if (next !== theme()) {
      setThemeSignal(next);
      applyTheme(next, animate);
      props.onChange?.(next);
    }

    const userId = props.userId?.();
    if (persist && userId && props.preferences) {
      const preferences = props.preferences;
      preferenceSaveQueue = preferenceSaveQueue
        .catch(() => undefined)
        .then(() => preferences.save(userId, next))
        .catch((error) => {
          console.warn('Failed to save theme preference', error);
        });
    }
  };

  // When a user signs in, adopt the theme stored in their preferences.
  createEffect(
    on(
      () => props.userId?.(),
      (userId) => {
        if (!userId || !props.preferences) {
          return;
        }
        const revision = themeChangeRevision;
        props.preferences
          .load(userId)
          .then((preferences) => {
            if (
              props.userId?.() !== userId ||
              themeChangeRevision !== revision
            ) {
              return;
            }
            if (isTheme(preferences?.theme)) {
              set(preferences.theme, { animate: false, persist: false });
            }
          })
          .catch((error) => {
            console.warn('Failed to load theme preference', error);
          });
      }
    )
  );

  const value: ThemeContextValue = {
    theme,
    setTheme: (next) => set(next),
    toggleTheme: () => set(theme() === 'dark' ? 'light' : 'dark'),
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
