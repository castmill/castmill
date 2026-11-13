/**
 * Localized labels for ui-common TableView/ToolBar responsive layouts
 * (stacked phone cards and the collapsible "Filters" toggle) in addons.
 */
import type { TableCardLabels } from '@castmill/ui-common';

export type Translate = (key: string, params?: Record<string, any>) => string;

/** Translates `key`, using the English `fallback` when it is untranslated. */
const translate =
  (t: Translate, key: string, fallback: string, params?: Record<string, any>) =>
  () => {
    const value = t(key, params);
    return value && value !== key ? value : fallback;
  };

export const tableCardLabels = (t: Translate): TableCardLabels => ({
  sortBy: translate(t, 'common.sortBy', 'Sort by'),
  sortAscending: translate(t, 'common.sortAscending', 'Ascending'),
  sortDescending: translate(t, 'common.sortDescending', 'Descending'),
  selectAll: translate(t, 'common.selectAll', 'Select all'),
  selectRow: (id) =>
    translate(t, 'common.selectRow', `Select row ${id}`, { id })(),
});

export const filtersLabel = (t: Translate) =>
  translate(t, 'filters.toggle', 'Filters');

export const organizeByLabel = (t: Translate) =>
  translate(t, 'tags.groups.organizeBy', 'Organize by');
