/** @jsxImportSource solid-js */

/**
 * MultiSelectFilter
 *
 * A sleek, reusable multi-select dropdown with built-in search.
 * Designed for toolbar filter scenarios — compact trigger, floating panel,
 * customizable item rendering, and optional filter-mode toggle.
 *
 * Usage:
 *   <MultiSelectFilter
 *     items={tags()}
 *     selectedIds={selectedTagIds()}
 *     onSelectionChange={handleTagChange}
 *     renderItem={(tag) => <span>{tag.name}</span>}
 *     renderChip={(tag) => <TagBadge tag={tag} size="small" />}
 *     label="Tags"
 *     placeholder="Filter by tags…"
 *     searchable
 *   />
 */

import { For, JSX, Show, createMemo, createSignal, onCleanup } from 'solid-js';
import { IoChevronDown, IoClose } from 'solid-icons/io';
import { AiOutlineSearch } from 'solid-icons/ai';
import { IconWrapper } from '../icon-wrapper';

import './multi-select-filter.scss';

// ───────────────────────── Types ─────────────────────────

export interface MultiSelectItem {
  id: number | string;
  name: string;
  [key: string]: any; // Allow extra metadata (color, icon, …)
}

export interface FilterModeOption {
  value: string;
  label: string;
}

export interface MultiSelectFilterProps<T extends MultiSelectItem> {
  /** The full list of selectable items */
  items: T[];

  /** Currently selected item IDs */
  selectedIds: (number | string)[];

  /** Called when the selection changes */
  onSelectionChange: (ids: (number | string)[]) => void;

  /** Render a single item inside the dropdown list */
  renderItem?: (item: T, selected: boolean) => JSX.Element;

  /** Render a chip/badge for a selected item in the trigger area */
  renderChip?: (item: T) => JSX.Element;

  /** Label shown above the trigger (optional) */
  label?: string;

  /** Placeholder text when nothing is selected */
  placeholder?: string;

  /** Whether to show the search input in the dropdown */
  searchable?: boolean;

  /** Search placeholder (default: "Search…") */
  searchPlaceholder?: string;

  /** Maximum number of chips to show in the trigger before collapsing */
  maxDisplayedChips?: number;

  /** Filter mode options (e.g. any/all). If provided, a toggle is shown. */
  filterModes?: FilterModeOption[];

  /** Currently active filter mode */
  filterMode?: string;

  /** Callback when filter mode changes */
  onFilterModeChange?: (mode: string) => void;

  /** Disable the entire component */
  disabled?: boolean;

  /** Accessible label for the clear button */
  clearLabel?: string;

  /** Message shown when search yields no results (default: "No matches") */
  noMatchMessage?: string;

  /** Message shown when the item list is empty (default: "No items") */
  emptyMessage?: string;
}

// ───────────────────── Component ─────────────────────

export const MultiSelectFilter = <T extends MultiSelectItem>(
  props: MultiSelectFilterProps<T>
): JSX.Element => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // ── Derived data ────────────────────────────────────

  const filteredItems = createMemo(() => {
    const q = searchQuery().toLowerCase().trim();
    if (!q) return props.items;
    return props.items.filter((item) => item.name.toLowerCase().includes(q));
  });

  const selectedItems = createMemo(() =>
    props.items.filter((item) => props.selectedIds.includes(item.id))
  );

  const isSelected = (id: number | string) => props.selectedIds.includes(id);

  // ── Interaction ─────────────────────────────────────

  const toggleItem = (id: number | string) => {
    if (props.disabled) return;
    const next = isSelected(id)
      ? props.selectedIds.filter((i) => i !== id)
      : [...props.selectedIds, id];
    props.onSelectionChange(next);
  };

  const clearAll = (e?: MouseEvent) => {
    e?.stopPropagation();
    props.onSelectionChange([]);
  };

  const open = () => {
    if (props.disabled) return;
    setIsOpen(true);
    setSearchQuery('');
    setTimeout(() => inputRef?.focus(), 10);
  };

  const close = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const toggle = () => (isOpen() ? close() : open());

  // ── Click-outside ───────────────────────────────────

  const onDocClick = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      close();
    }
  };

  document.addEventListener('mousedown', onDocClick);
  onCleanup(() => document.removeEventListener('mousedown', onDocClick));

  // ── Keyboard ────────────────────────────────────────

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  // ── Default renderers ───────────────────────────────

  const defaultRenderItem = (item: T, selected: boolean) => (
    <div class="msf-item-default">
      <span class="msf-item-name">{item.name}</span>
      <Show when={selected}>
        <span class="msf-item-check">✓</span>
      </Show>
    </div>
  );

  const defaultRenderChip = (item: T) => (
    <span class="msf-chip-default">{item.name}</span>
  );

  const renderItemFn = () => props.renderItem || defaultRenderItem;
  const renderChipFn = () => props.renderChip || defaultRenderChip;

  // ── Template ────────────────────────────────────────

  return (
    <Show when={props.items.length > 0}>
      <div
        class="castmill-msf"
        classList={{ disabled: !!props.disabled }}
        ref={containerRef}
        onKeyDown={onKeyDown}
      >
        {/* Trigger */}
        <button
          type="button"
          class="msf-trigger"
          classList={{ open: isOpen() }}
          onClick={toggle}
          aria-expanded={isOpen()}
          aria-haspopup="listbox"
          disabled={props.disabled}
        >
          <div class="msf-trigger-inner">
            <Show when={props.label}>
              <span class="msf-label">{props.label}</span>
            </Show>
            <div class="msf-trigger-content">
              <Show
                when={selectedItems().length > 0}
                fallback={
                  <span class="msf-placeholder">
                    {props.placeholder || 'Select…'}
                  </span>
                }
              >
                <div class="msf-chips">
                  <For
                    each={
                      props.maxDisplayedChips
                        ? selectedItems().slice(0, props.maxDisplayedChips)
                        : selectedItems()
                    }
                  >
                    {(item) => (
                      <span
                        class="msf-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleItem(item.id);
                        }}
                      >
                        {renderChipFn()(item)}
                        <span class="msf-chip-remove">
                          <IconWrapper icon={IoClose} />
                        </span>
                      </span>
                    )}
                  </For>
                  <Show
                    when={
                      props.maxDisplayedChips &&
                      selectedItems().length > props.maxDisplayedChips
                    }
                  >
                    <span class="msf-overflow">
                      +{selectedItems().length - (props.maxDisplayedChips || 0)}
                    </span>
                  </Show>
                </div>
              </Show>
            </div>
          </div>

          <div class="msf-trigger-actions">
            <Show when={selectedItems().length > 0}>
              <span
                class="msf-clear"
                role="button"
                tabIndex={0}
                aria-label={props.clearLabel || 'Clear selection'}
                onClick={clearAll}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    clearAll();
                  }
                }}
              >
                <IconWrapper icon={IoClose} />
              </span>
            </Show>
            <span class="msf-arrow" classList={{ rotated: isOpen() }}>
              <IconWrapper icon={IoChevronDown} />
            </span>
          </div>
        </button>

        {/* Floating panel */}
        <Show when={isOpen()}>
          <div class="msf-panel" role="listbox">
            {/* Search */}
            <Show when={props.searchable}>
              <div class="msf-search">
                <span class="msf-search-icon">
                  <IconWrapper icon={AiOutlineSearch} />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={props.searchPlaceholder || 'Search…'}
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                />
              </div>
            </Show>

            {/* Filter-mode toggle */}
            <Show
              when={
                props.filterModes &&
                props.filterModes.length > 1 &&
                selectedItems().length > 1
              }
            >
              <div class="msf-mode-bar">
                <For each={props.filterModes}>
                  {(mode) => (
                    <button
                      type="button"
                      class="msf-mode-btn"
                      classList={{ active: props.filterMode === mode.value }}
                      onClick={() => props.onFilterModeChange?.(mode.value)}
                    >
                      {mode.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>

            {/* Item list */}
            <div class="msf-list">
              <Show
                when={filteredItems().length > 0}
                fallback={
                  <div class="msf-empty">
                    {searchQuery()
                      ? props.noMatchMessage || 'No matches'
                      : props.emptyMessage || 'No items'}
                  </div>
                }
              >
                <For each={filteredItems()}>
                  {(item) => (
                    <div
                      class="msf-option"
                      classList={{ selected: isSelected(item.id) }}
                      role="option"
                      aria-selected={isSelected(item.id)}
                      tabIndex={0}
                      onClick={() => toggleItem(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleItem(item.id);
                        }
                      }}
                    >
                      {renderItemFn()(item, isSelected(item.id))}
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};
