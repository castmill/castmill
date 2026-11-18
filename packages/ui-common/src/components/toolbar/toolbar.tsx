/** @jsxImportSource solid-js */
import {
  createSignal,
  createUniqueId,
  For,
  Show,
  JSX,
  onCleanup,
} from 'solid-js';
import { FaSolidMagnifyingGlass, FaSolidSliders } from 'solid-icons/fa';

import { Switch } from '../switch/switch';
import { IconWrapper } from '../icon-wrapper';
import { usePhoneLayout } from '../../hooks/useMediaQuery';

import './toolbar.scss';

const SEARCH_DEBOUNCE_PERIOD = 300;

export interface Filter {
  key: string; // Unique key identifier for the filter
  name: string; // Human-readable name, used for display purposes
  isActive: boolean; // Whether the filter is currently active
}

interface ToolBarProps {
  title?: string | (() => string);
  titleActions?: JSX.Element; // Rendered on the same row as the title
  filters?: Filter[];
  onFilterChange?: (filters: Filter[]) => void;
  actions?: JSX.Element | (() => JSX.Element);
  onSearch?: (searchText: string) => void;
  initialSearchText?: string;
  mainAction?: JSX.Element; // Changed type to accept a JSX element
  requireOneActiveFilter?: boolean; // When true (default), at least one filter must remain active
  hideSearch?: boolean; // When true, hides the search input
  searchPlaceholder?: string; // Placeholder for the search input
  /** Label of the toggle that reveals filters/actions on phones. Default: "Filters" */
  filtersLabel?: string | (() => string);
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

  const getTitle = () =>
    typeof props.title === 'function' ? props.title() : props.title;

  // On phones the filters and secondary actions collapse behind a toggle so
  // that search and the primary action fit on one row.
  const isPhone = usePhoneLayout();
  const [filtersOpen, setFiltersOpen] = createSignal(false);
  const filtersPanelId = `toolbar-filters-${createUniqueId()}`;
  const hasFilters = () => !!props.filters && props.filters.length > 0;
  const hasCollapsible = () => hasFilters() || !!props.actions;
  const compact = () => isPhone() && hasCollapsible();
  const getFiltersLabel = () =>
    (typeof props.filtersLabel === 'function'
      ? props.filtersLabel()
      : props.filtersLabel) || 'Filters';

  return (
    <div class="toolbar-container">
      <Show when={props.title || props.titleActions}>
        <div class="toolbar-title-row">
          <Show when={props.title}>
            <h2 class="toolbar-title">{getTitle()}</h2>
          </Show>
          <Show when={props.titleActions}>{props.titleActions}</Show>
        </div>
      </Show>
      <div class="toolbar-row" classList={{ compact: compact() }}>
        <div class="toolbar-left">
          <Show when={props.onSearch && !props.hideSearch}>
            <div class="search-container">
              <IconWrapper icon={FaSolidMagnifyingGlass} />

              <input
                type="text"
                value={searchText()}
                onInput={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder={props.searchPlaceholder ?? 'Search...'}
                class="search-input"
              />
            </div>
          </Show>

          <Show when={compact()}>
            <button
              type="button"
              class="toolbar-filters-toggle"
              classList={{ open: filtersOpen() }}
              aria-expanded={filtersOpen()}
              aria-controls={filtersPanelId}
              onClick={() => setFiltersOpen(!filtersOpen())}
            >
              <IconWrapper icon={FaSolidSliders} />
              <span>{getFiltersLabel()}</span>
            </button>
          </Show>

          <Show when={hasCollapsible()}>
            <div
              id={filtersPanelId}
              class="toolbar-filters"
              classList={{ collapsed: compact() && !filtersOpen() }}
              data-testid="toolbar-filters"
            >
              <Show when={hasFilters()}>
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
          </Show>
        </div>

        <Show when={props.mainAction}>
          <div class="toolbar-right">{props.mainAction}</div>
        </Show>
      </div>
    </div>
  );
}
