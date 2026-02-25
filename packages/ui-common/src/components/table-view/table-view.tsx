/** @jsxImportSource solid-js */

/**
 * Castmill Table View component.
 * Provides a common table view including pagination, searching, sorting, and selection.
 * (c) 2024 Castmill AB.
 */
import { JSX, Show, createSignal, onMount } from 'solid-js';
import {
  Filter,
  ItemBase,
  Pagination,
  Table,
  TableAction,
  ToolBar,
  SelectionActionBar,
} from '../';
import { PermissionDenied } from '../permission-denied/permission-denied';
import { SortOptions } from '../../interfaces/sort-options.interface';

import style from './table-view.module.scss';

export interface FetchDataOptions {
  page: { num: number; size: number };
  sortOptions: SortOptions;
  search?: string;
  filters?: Record<string, string | boolean>;
  team_id?: number | null;
}

export interface TableViewRef<
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
> {
  reloadData: () => Promise<void>;
  updateItem: (itemId: IdType, item: Partial<Item>) => void;
  focusSearch: () => void;
}

// Type aliases for URL params that are compatible with both SolidJS router and internal usage
type Params = Record<string, string | undefined>;
type SetParams = Record<string, string | number | boolean | undefined>;

interface TableViewProps<
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
> {
  title?: string | (() => string);
  resource: string;
  params?: [Params, (params: SetParams, options?: any) => void]; // typeof useSearchParams;
  ref?: (ref: TableViewRef<IdType, Item>) => void;
  fetchData: (params: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => Promise<{ data: Item[]; count: number }>;

  table: {
    columns:
      | {
          key: string;
          title: string | (() => string);
          sortable?: boolean;
        }[]
      | (() => {
          key: string;
          title: string | (() => string);
          sortable?: boolean;
        }[]);
    onSort?: (options: SortOptions) => void;
    actions?: TableAction<Item>[] | (() => TableAction<Item>[]);
    actionsLabel?: string | (() => string);
    onRowSelect?: (selectedIds: Set<IdType>) => void;
    defaultRowAction?: TableAction<Item>;
    hideCheckboxes?: boolean;
  };

  pagination: {
    itemsPerPage: number;
  };

  toolbar?: {
    filters?: Filter[];
    mainAction?: JSX.Element;
    actions?: JSX.Element;
    titleActions?: JSX.Element;
    requireOneActiveFilter?: boolean;
    hideSearch?: boolean;
    hideTitle?: boolean;
  };

  /** Render prop for bulk actions shown in the floating selection bar */
  selectionActions?: (selection: {
    count: number;
    clear: () => void;
  }) => JSX.Element;

  /** Label for the selection bar — use {count} as placeholder */
  selectionLabel?: string;

  /** Hint message shown when no items are selected, guiding users to use checkboxes */
  selectionHint?: string;

  itemIdKey?: string;

  /** Tag filter notification props */
  tagFilterNotification?: {
    isActive: boolean;
    message: string;
    onClear: () => void;
  };
}

export const TableView = <
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
>(
  props: TableViewProps<IdType, Item>
): JSX.Element => {
  const [data, setData] = createSignal<Item[]>([]);

  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalItems, setTotalItems] = createSignal(0);

  const [loadingError, setLoadingError] = createSignal('');
  const [errorStatus, setErrorStatus] = createSignal<number | null>(null);

  const [filters, setFilters] = createSignal<Filter[]>(
    props.toolbar?.filters || []
  );

  // Track selection count for the floating action bar
  const [selectedCount, setSelectedCount] = createSignal(0);
  let clearSelectionRef: (() => void) | undefined;

  const handleRowSelect = (selectedIds: Set<IdType>) => {
    setSelectedCount(selectedIds.size);
    props.table.onRowSelect?.(selectedIds);
  };

  const clearSelection = () => {
    setSelectedCount(0);
    // Notify parent to clear their selection state
    props.table.onRowSelect?.(new Set<IdType>());
    // Clear internal table checkboxes via reload workaround
    clearSelectionRef?.();
  };

  // If props.params is defined, it’s `[searchParams, setSearchParams]` from useSearchParams
  // Otherwise use reactive signals (or store) as a fallback
  // Track current sort options
  const [sortOptions, setSortOptions] = createSignal<SortOptions>({
    key: 'name',
    direction: 'ascending',
  });

  const [fallbackParams, setFallbackParams] = createSignal<{
    page?: number;
    search?: string;
    filters?: string;
    sortKey?: string;
    sortDirection?: string;
  }>({});

  const getSearchParams = () => {
    if (props.params) {
      const [searchParams, _] = props.params;
      return searchParams;
    }
    return fallbackParams();
  };

  const setSearchParams = (params: {
    page?: number;
    search?: string;
    filters?: string;
    sortKey?: string;
    sortDirection?: string;
  }) => {
    if (props.params) {
      const [searchParams, setSearchParamsEx] = props.params;
      console.log('setSearchParams', params);
      setSearchParamsEx({ ...searchParams, ...params });
    } else {
      setFallbackParams({ ...fallbackParams(), ...params });
    }
  };

  onMount(async () => {
    // Get initial filters from search params
    const initialFilters = getSearchParams().filters;

    if (initialFilters) {
      filters().forEach((filter) => {
        filter.isActive = initialFilters.includes(filter.key);
      });
    }

    // Get initial sort options from search params
    const params = getSearchParams();
    if (params.sortKey || params.sortDirection) {
      setSortOptions({
        key: params.sortKey,
        direction: params.sortDirection as 'ascending' | 'descending',
      });
    }

    // For dynamic loaded components we need this to wait for the next event loop
    // Not sure why, something to do with SolidJS reactivity internals.
    setTimeout(async () => {
      await updateData();
    });
  });

  const activeFilters = () =>
    filters()
      .filter((filter: { isActive: boolean }) => filter.isActive)
      .map((filter: { key: string }) => filter.key);

  const updateData = async () => {
    const params = getSearchParams();
    const { search = '', page = 1 } = params;

    try {
      const filtersObject = activeFilters().reduce(
        (acc: Record<string, boolean>, filter) => {
          acc[filter] = true;
          return acc;
        },
        {}
      );

      const result = await props.fetchData({
        page: { num: currentPage(), size: props.pagination.itemsPerPage },
        sortOptions: sortOptions(),
        search,
        filters: filters().length ? filtersObject : undefined,
      });

      setData(result.data);
      setTotalItems(result.count);
    } catch (err: any) {
      console.log('error', err);

      // Check if it's an HttpError with status code
      if (err && typeof err.status === 'number') {
        setErrorStatus(err.status);
      }

      setLoadingError(`Error fetching ${props.resource}: ${err}`);
    }
  };

  const handleChange = async (opts: {
    page?: number;
    search?: string;
    filters?: string;
    sortKey?: string;
    sortDirection?: string;
  }) => {
    // Since it takes one event loop to update the search params, we need to wait for it.
    await new Promise<void>((resolve) =>
      setTimeout(async () => {
        const params = {} as SetParams;

        console.log({ opts });

        if (opts.page) {
          params['page'] = opts.page;
          if (opts.page != currentPage()) {
            setCurrentPage(opts.page);
          }
        }

        if (typeof opts.search != 'undefined') {
          params['search'] = opts.search;
        }

        if (typeof opts.filters != 'undefined') {
          params['filters'] = opts.filters;
        }

        if (typeof opts.sortKey != 'undefined') {
          params['sortKey'] = opts.sortKey;
        }

        if (typeof opts.sortDirection != 'undefined') {
          params['sortDirection'] = opts.sortDirection;
        }

        console.log('handleChange', params);
        setSearchParams(params);

        resolve();
      }, 0)
    );
    await updateData();
  };

  const handlePageChange = async (newPage: number) => {
    await handleChange({ page: newPage });
  };

  const handleSearch = async (search: string) => {
    if (search === getSearchParams().search) {
      return;
    }
    await handleChange({ search, page: 1 });
  };

  const handleFilterChange = async (updatedFilters: Filter[]) => {
    setFilters(updatedFilters);
    await handleChange({
      filters: activeFilters().join(','),
      page: 1,
    });
  };

  const handleSort = async (options: SortOptions) => {
    setSortOptions(options);
    await handleChange({
      sortKey: options.key,
      sortDirection: options.direction,
      page: 1, // Reset to first page when sorting changes
    });
  };

  const ref = {
    reloadData: async () => {
      await updateData();
    },
    updateItem: (itemId: IdType, item: Partial<Item>) => {
      setData((prevData: Item[]) => {
        return prevData.map((prevItem) => {
          if (prevItem.id === itemId) {
            return { ...prevItem, ...item };
          }
          return prevItem;
        });
      });
    },
    focusSearch: () => {
      const searchInput = document.querySelector(
        '.search-input'
      ) as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    },
  };

  if (props.ref) {
    props.ref(ref); // Assign the methods to the ref passed from the parent
  }

  const getTitle = () =>
    typeof props.title === 'function' ? props.title() : props.title;

  return (
    <>
      <Show
        when={!loadingError()}
        fallback={
          <Show
            when={errorStatus() === 403}
            fallback={<div>Loading Error: {loadingError()}</div>}
          >
            <PermissionDenied resource={props.resource} />
          </Show>
        }
      >
        <div class={style['table-view']}>
          <Show when={props.toolbar}>
            <ToolBar
              title={props.toolbar?.hideTitle ? undefined : getTitle()}
              titleActions={props.toolbar?.titleActions}
              filters={filters()}
              onFilterChange={handleFilterChange}
              initialSearchText={(getSearchParams().search as string) || ''}
              onSearch={handleSearch}
              mainAction={props.toolbar?.mainAction}
              actions={props.toolbar?.actions}
              requireOneActiveFilter={props.toolbar?.requireOneActiveFilter}
              hideSearch={props.toolbar?.hideSearch}
            />
          </Show>

          <Table<IdType, Item>
            columns={props.table.columns}
            data={data()}
            actions={props.table.actions}
            actionsLabel={props.table.actionsLabel}
            onRowSelect={handleRowSelect}
            onSort={handleSort}
            onRowClick={props.table.defaultRowAction?.handler}
            itemIdKey={props.itemIdKey}
            hideCheckboxes={props.table.hideCheckboxes}
            clearSelectionRef={(fn) => {
              clearSelectionRef = fn;
            }}
          />

          <Show when={props.selectionActions}>
            <SelectionActionBar
              count={selectedCount()}
              onDeselectAll={clearSelection}
              label={props.selectionLabel}
              hintMessage={props.selectionHint}
            >
              {props.selectionActions?.({
                count: selectedCount(),
                clear: clearSelection,
              })}
            </SelectionActionBar>
          </Show>

          <div
            class={`${style['pagination-wrapper']} ${totalItems() <= props.pagination.itemsPerPage ? style['hidden'] : ''}`}
          >
            <Pagination
              itemsPerPage={props.pagination.itemsPerPage}
              totalItems={totalItems()}
              currentPage={currentPage()}
              onPageChange={handlePageChange}
            />
            <div class={style['pagination-text']}>
              Showing {data().length} of {totalItems()} {props.resource}
            </div>
          </div>

          <Show when={props.tagFilterNotification?.isActive}>
            <div class={style['filter-notification']}>
              <span class={style['filter-notification-icon']}>ℹ️</span>
              <span class={style['filter-notification-text']}>
                {props.tagFilterNotification?.message}
              </span>
              <button
                class={style['filter-notification-clear']}
                onClick={props.tagFilterNotification?.onClear}
              >
                ×
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </>
  );
};
