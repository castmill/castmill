import { describe, it, expect } from 'vitest';
import { filtersLabel, organizeByLabel, tableCardLabels } from './table-labels';

const resolve = (label: unknown) =>
  typeof label === 'function' ? (label as () => string)() : label;

describe('table-labels', () => {
  it('translates card, filters and tree labels', () => {
    const t = (key: string, params?: Record<string, any>) =>
      params?.id ? `${key}:${params.id}` : `T(${key})`;
    const labels = tableCardLabels(t);
    expect(resolve(labels.sortBy)).toBe('T(common.sortBy)');
    expect(resolve(labels.sortAscending)).toBe('T(common.sortAscending)');
    expect(resolve(labels.sortDescending)).toBe('T(common.sortDescending)');
    expect(resolve(labels.selectAll)).toBe('T(common.selectAll)');
    expect(labels.selectRow?.('7')).toBe('common.selectRow:7');
    expect(filtersLabel(t)()).toBe('T(filters.toggle)');
    expect(organizeByLabel(t)()).toBe('T(tags.groups.organizeBy)');
  });

  it('falls back to English when a key is untranslated', () => {
    const t = (key: string) => key;
    const labels = tableCardLabels(t);
    expect(resolve(labels.sortBy)).toBe('Sort by');
    expect(resolve(labels.sortAscending)).toBe('Ascending');
    expect(resolve(labels.sortDescending)).toBe('Descending');
    expect(resolve(labels.selectAll)).toBe('Select all');
    expect(labels.selectRow?.('7')).toBe('Select row 7');
    expect(filtersLabel(t)()).toBe('Filters');
    expect(organizeByLabel(() => '')()).toBe('Organize by');
  });
});
