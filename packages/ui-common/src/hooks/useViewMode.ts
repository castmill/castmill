import { createSignal, createEffect, on } from 'solid-js';
import type { ViewMode } from '../components/view-mode-toggle/view-mode-toggle';

const STORAGE_PREFIX = 'castmill-viewMode-';

/**
 * A persisted view-mode signal. The initial value is read from localStorage
 * (falling back to `'list'`), and every change is written back automatically.
 *
 * @param pageKey A unique key per page, e.g. `'channels'`.
 */
export function useViewMode(pageKey: string) {
  const storageKey = `${STORAGE_PREFIX}${pageKey}`;

  const stored = localStorage.getItem(storageKey) as ViewMode | null;
  const initial: ViewMode =
    stored === 'list' || stored === 'tree' ? stored : 'list';

  const [viewMode, setViewMode] = createSignal<ViewMode>(initial);

  // Persist on change
  createEffect(
    on(viewMode, (mode) => {
      localStorage.setItem(storageKey, mode);
    })
  );

  return [viewMode, setViewMode] as const;
}
