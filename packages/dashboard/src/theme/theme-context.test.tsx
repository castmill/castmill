import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import {
  ThemeProvider,
  ThemePreferencesApi,
  applyTheme,
  getInitialTheme,
  syncThemeColor,
  THEME_COLORS,
  isTheme,
  useTheme,
  THEME_STORAGE_KEY,
} from './theme-context';

const setMatchMedia = (matches: Record<string, boolean>) => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: !!matches[query],
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

let api: ReturnType<typeof useTheme>;
const Capture = () => {
  api = useTheme();
  return null;
};

const createPreferences = (
  theme?: string
): ThemePreferencesApi & {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} => ({
  load: vi.fn().mockResolvedValue(theme ? { theme } : {}),
  save: vi.fn().mockResolvedValue({}),
});

describe('theme-context', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove('theme-transitioning');
    setMatchMedia({});
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    delete (document as any).startViewTransition;
    vi.useRealTimers();
  });

  describe('isTheme', () => {
    it('accepts only light and dark', () => {
      expect(isTheme('light')).toBe(true);
      expect(isTheme('dark')).toBe(true);
      expect(isTheme('purple')).toBe(false);
      expect(isTheme(undefined)).toBe(false);
    });
  });

  describe('getInitialTheme', () => {
    it('defaults to dark', () => {
      expect(getInitialTheme()).toBe('dark');
    });

    it('uses the stored theme first', () => {
      setMatchMedia({ '(prefers-color-scheme: light)': true });
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      expect(getInitialTheme()).toBe('dark');
    });

    it('ignores invalid stored values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'purple');
      expect(getInitialTheme()).toBe('dark');
    });

    it('falls back to the OS light preference', () => {
      setMatchMedia({ '(prefers-color-scheme: light)': true });
      expect(getInitialTheme()).toBe('light');
    });
  });

  describe('syncThemeColor', () => {
    const themeColor = () =>
      document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

    beforeEach(() => themeColor()?.remove());

    it('creates the theme-color meta tag when it is missing', () => {
      syncThemeColor('light');
      expect(themeColor()?.content).toBe(THEME_COLORS.light);
    });

    it('updates an existing theme-color meta tag', () => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#000000';
      document.head.appendChild(meta);

      syncThemeColor('dark');

      expect(
        document.head.querySelectorAll('meta[name="theme-color"]')
      ).toHaveLength(1);
      expect(meta.content).toBe(THEME_COLORS.dark);
    });

    it('follows applyTheme, also when the theme is already set', () => {
      applyTheme('light');
      expect(themeColor()?.content).toBe(THEME_COLORS.light);

      themeColor()!.content = '#000000';
      applyTheme('light');
      expect(themeColor()?.content).toBe(THEME_COLORS.light);

      applyTheme('dark');
      expect(themeColor()?.content).toBe(THEME_COLORS.dark);
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme without animation', () => {
      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(
        document.documentElement.classList.contains('theme-transitioning')
      ).toBe(false);
    });

    it('uses the View Transitions API when available', () => {
      const startViewTransition = vi.fn((cb: () => void) => cb());
      (document as any).startViewTransition = startViewTransition;

      applyTheme('light', true);

      expect(startViewTransition).toHaveBeenCalledTimes(1);
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('invalidates a queued transition when a later request matches the current theme', () => {
      const callbacks: (() => void)[] = [];
      (document as any).startViewTransition = (callback: () => void) => {
        callbacks.push(callback);
      };
      applyTheme('dark');

      applyTheme('light', true);
      applyTheme('dark', true);
      callbacks[0]();

      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('falls back to a temporary CSS transition class', () => {
      vi.useFakeTimers();
      applyTheme('light', true);

      const root = document.documentElement;
      expect(root.dataset.theme).toBe('light');
      expect(root.classList.contains('theme-transitioning')).toBe(true);

      vi.runAllTimers();
      expect(root.classList.contains('theme-transitioning')).toBe(false);
    });

    it('skips the animation when reduced motion is preferred', () => {
      setMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      const startViewTransition = vi.fn();
      (document as any).startViewTransition = startViewTransition;

      applyTheme('light', true);

      expect(startViewTransition).not.toHaveBeenCalled();
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('does nothing when the theme is already applied', () => {
      applyTheme('dark');
      const startViewTransition = vi.fn();
      (document as any).startViewTransition = startViewTransition;

      applyTheme('dark', true);
      expect(startViewTransition).not.toHaveBeenCalled();
    });
  });

  describe('ThemeProvider', () => {
    it('applies the initial theme and notifies onChange', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      const onChange = vi.fn();

      render(() => (
        <ThemeProvider onChange={onChange}>
          <Capture />
        </ThemeProvider>
      ));

      expect(api.theme()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(onChange).toHaveBeenCalledWith('light');
    });

    it('toggles, persists locally and saves to the user preferences', async () => {
      const preferences = createPreferences();
      const onChange = vi.fn();

      render(() => (
        <ThemeProvider
          userId={() => 'user-1'}
          preferences={preferences}
          onChange={onChange}
        >
          <Capture />
        </ThemeProvider>
      ));

      api.toggleTheme();

      expect(api.theme()).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
      await waitFor(() =>
        expect(preferences.save).toHaveBeenCalledWith('user-1', 'light')
      );
      expect(onChange).toHaveBeenLastCalledWith('light');

      api.setTheme('dark');
      expect(api.theme()).toBe('dark');
      await waitFor(() =>
        expect(preferences.save).toHaveBeenLastCalledWith('user-1', 'dark')
      );
    });

    it('serializes preference saves so the latest theme is saved last', async () => {
      const preferences = createPreferences();
      let resolveFirstSave!: () => void;
      preferences.save
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveFirstSave = resolve;
            })
        )
        .mockResolvedValueOnce({});

      render(() => (
        <ThemeProvider userId={() => 'user-1'} preferences={preferences}>
          <Capture />
        </ThemeProvider>
      ));

      api.setTheme('light');
      api.setTheme('dark');

      await waitFor(() => expect(preferences.save).toHaveBeenCalledTimes(1));
      expect(preferences.save).toHaveBeenCalledTimes(1);
      expect(preferences.save).toHaveBeenNthCalledWith(1, 'user-1', 'light');

      resolveFirstSave();
      await waitFor(() => expect(preferences.save).toHaveBeenCalledTimes(2));
      expect(preferences.save).toHaveBeenNthCalledWith(2, 'user-1', 'dark');
    });

    it('does not save to the server when signed out', () => {
      const preferences = createPreferences();

      render(() => (
        <ThemeProvider userId={() => undefined} preferences={preferences}>
          <Capture />
        </ThemeProvider>
      ));

      api.toggleTheme();
      expect(api.theme()).toBe('light');
      expect(preferences.save).not.toHaveBeenCalled();
      expect(preferences.load).not.toHaveBeenCalled();
    });

    it('adopts the server preference when the user signs in', async () => {
      const preferences = createPreferences('light');
      const [userId, setUserId] = createSignal<string | undefined>();

      render(() => (
        <ThemeProvider userId={userId} preferences={preferences}>
          <Capture />
        </ThemeProvider>
      ));

      expect(api.theme()).toBe('dark');
      setUserId('user-1');

      await waitFor(() => expect(api.theme()).toBe('light'));
      expect(preferences.load).toHaveBeenCalledWith('user-1');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
      // Loading the server preference must not write it back.
      expect(preferences.save).not.toHaveBeenCalled();
    });

    it('ignores a preference load that resolves after an explicit theme change', async () => {
      let resolveLoad!: (preferences: { theme: string }) => void;
      const preferences = createPreferences();
      preferences.load.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          })
      );

      render(() => (
        <ThemeProvider userId={() => 'user-1'} preferences={preferences}>
          <Capture />
        </ThemeProvider>
      ));

      await waitFor(() =>
        expect(preferences.load).toHaveBeenCalledWith('user-1')
      );

      api.setTheme('light');
      resolveLoad({ theme: 'dark' });
      await Promise.resolve();

      expect(api.theme()).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('keeps the local theme when the server has no preference', async () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      const preferences = createPreferences();

      render(() => (
        <ThemeProvider userId={() => 'user-1'} preferences={preferences}>
          <Capture />
        </ThemeProvider>
      ));

      await waitFor(() => expect(preferences.load).toHaveBeenCalled());
      expect(api.theme()).toBe('light');
    });

    it('tolerates preference load and save failures', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const preferences = {
        load: vi.fn().mockRejectedValue(new Error('offline')),
        save: vi.fn().mockRejectedValue(new Error('offline')),
      };

      render(() => (
        <ThemeProvider userId={() => 'user-1'} preferences={preferences}>
          <Capture />
        </ThemeProvider>
      ));

      api.toggleTheme();
      expect(api.theme()).toBe('light');
      await waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
      warn.mockRestore();
    });

    it('ignores invalid themes', () => {
      render(() => (
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      ));

      api.setTheme('purple' as any);
      expect(api.theme()).toBe('dark');
    });

    it('throws when useTheme is used outside the provider', () => {
      expect(() => render(() => <Capture />)).toThrow(
        'useTheme must be used within a ThemeProvider'
      );
    });
  });
});
