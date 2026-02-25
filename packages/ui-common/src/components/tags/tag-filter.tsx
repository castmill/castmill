/** @jsxImportSource solid-js */

/**
 * TagFilter Component
 *
 * A multi-select filter specialized for tags. Wraps MultiSelectFilter
 * with tag-specific rendering (color dots, badges).
 */

import { Component, Show } from 'solid-js';
import type { Tag } from '../../services/tags.service';
import { MultiSelectFilter } from '../multi-select-filter/multi-select-filter';
import type { FilterModeOption } from '../multi-select-filter/multi-select-filter';

import './tag-filter.scss';

export interface TagFilterProps {
  tags: Tag[];
  selectedTagIds: number[];
  onTagChange: (tagIds: number[]) => void;
  filterMode?: 'any' | 'all';
  onFilterModeChange?: (mode: 'any' | 'all') => void;
  label?: string;
  placeholder?: string;
  clearLabel?: string;
  showFilterModeToggle?: boolean;
  disabled?: boolean;
  maxDisplayedTags?: number;
  /** Labels for the filter mode toggle buttons */
  filterModeLabels?: { any: string; all: string };
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Message when search yields no results */
  noMatchMessage?: string;
  /** Message when there are no tags */
  emptyMessage?: string;
}

const defaultFilterModes: FilterModeOption[] = [
  { value: 'any', label: 'Any' },
  { value: 'all', label: 'All' },
];

export const TagFilter: Component<TagFilterProps> = (props) => {
  const filterModes = () => {
    if (!props.showFilterModeToggle) return undefined;
    if (props.filterModeLabels) {
      return [
        { value: 'any', label: props.filterModeLabels.any },
        { value: 'all', label: props.filterModeLabels.all },
      ];
    }
    return defaultFilterModes;
  };

  return (
    <MultiSelectFilter<Tag>
      items={props.tags}
      selectedIds={props.selectedTagIds}
      onSelectionChange={(ids) => props.onTagChange(ids as number[])}
      label={props.label}
      placeholder={props.placeholder || 'Filter by tags\u2026'}
      clearLabel={props.clearLabel}
      disabled={props.disabled}
      searchable
      searchPlaceholder={props.searchPlaceholder || 'Search tags\u2026'}
      noMatchMessage={props.noMatchMessage}
      emptyMessage={props.emptyMessage}
      maxDisplayedChips={props.maxDisplayedTags}
      filterModes={filterModes()}
      filterMode={props.filterMode}
      onFilterModeChange={(mode) =>
        props.onFilterModeChange?.(mode as 'any' | 'all')
      }
      renderItem={(tag, selected) => (
        <div class="tag-option-item">
          <span
            class="tag-color-dot"
            style={{ 'background-color': tag.color }}
          />
          <span class="tag-option-name">{tag.name}</span>
          <Show when={selected}>
            <span class="tag-option-check">✓</span>
          </Show>
        </div>
      )}
      renderChip={(tag) => (
        <span class="tag-chip-content">
          <span
            class="tag-chip-dot"
            style={{ 'background-color': tag.color }}
          />
          {tag.name}
        </span>
      )}
    />
  );
};
