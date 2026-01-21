/** @jsxImportSource solid-js */
import { createSignal, For, Show, JSX, onCleanup } from 'solid-js';
import { FaSolidMagnifyingGlass } from 'solid-icons/fa';

import { Switch } from '../switch/switch';
import { IconWrapper } from '../icon-wrapper';

import './toolbar.scss';

const SEARCH_DEBOUNCE_PERIOD = 300;

export interface Filter {
  key: string; // Unique key identifier for the filter
  name: string; // Human-readable name, used for display purposes
  isActive: boolean; // Whether the filter is currently active
}

interface ToolBarProps {
  title?: string;
  filters?: Filter[];
  onFilterChange?: (filters: Filter[]) => void;
  actions?: JSX.Element | (() => JSX.Element);
  onSearch?: (searchText: string) => void;
  initialSearchText?: string;
  mainAction?: JSX.Element; // Changed type to accept a JSX element
  requireOneActiveFilter?: boolean; // When true (default), at least one filter must remain active
  hideSearch?: boolean; // When true, hides the search input
}

export function ToolBar(props: ToolBarProps) {
  const [searchText, setSearchText] = createSignal(
    props.initialSearchText || ''
  );
  const [filters, setFilters] = createSignal<Filter[]>(props.filters || []);

  const [debounceTimeout, setDebounceTimeout] = createSignal<any | undefined>(
    undefined
  );

  const handleSearchChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setSearchText(target.value);

    // Clear the previous timeout
    clearTimeout(debounceTimeout());

    // Set up a new timeout
    setDebounceTimeout(
      setTimeout(() => {
        props.onSearch?.(target.value);
      }, SEARCH_DEBOUNCE_PERIOD)
    );
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Blur the search input when ESC is pressed
      (e.target as HTMLInputElement).blur();
    }
  };

  const toggleFilter = (filterKey: string) => {
    const currentFilter = filters().find((filter) => filter.key === filterKey);
    if (!currentFilter) return; // safeguard against undefined filter

    const activeFilters = filters().filter((f) => f.isActive);
    const requireOneActive = props.requireOneActiveFilter ?? true;

    // Only toggle the filter if there will be at least one filter left active (when required)
    if (
      requireOneActive &&
      currentFilter.isActive &&
      activeFilters.length === 1
    ) {
      return; // Prevent toggle if this is the only active filter
    }

    const updatedFilters = filters().map((filter) =>
      filter.key === filterKey
        ? { ...filter, isActive: !filter.isActive }
        : filter
    );

    setFilters(updatedFilters);
    props.onFilterChange?.(updatedFilters);
  };

  // Cleanup to clear the timeout when the component unmounts
  onCleanup(() => {
    clearTimeout(debounceTimeout());
  });

  return (
    <div class="toolbar-container">
      <div class="toolbar-left">
        <Show when={props.title}>
          <h2 class="toolbar-title">{props.title}</h2>
        </Show>
        <Show when={props.onSearch && !props.hideSearch}>
          <div class="search-container">
            <IconWrapper icon={FaSolidMagnifyingGlass} />

            <input
              type="text"
              value={searchText()}
              onInput={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              class="search-input"
            />
          </div>
        </Show>

        <Show when={props.filters && props.filters.length > 0}>
          <div class="filter-container">
            <For each={filters()}>
              {(filter) => (
                <Switch
                  name={filter.name}
                  key={filter.key}
                  isActive={filter.isActive}
                  disabled={
                    (props.requireOneActiveFilter ?? true) &&
                    filter.isActive &&
                    filters().filter((f) => f.isActive).length === 1
                  }
                  onToggle={() => toggleFilter(filter.key)}
                />
              )}
            </For>
          </div>
        </Show>

        <Show when={props.actions}>
          {typeof props.actions === 'function'
            ? props.actions()
            : props.actions}
        </Show>
      </div>

      <Show when={props.mainAction}>{props.mainAction}</Show>
    </div>
  );
}
