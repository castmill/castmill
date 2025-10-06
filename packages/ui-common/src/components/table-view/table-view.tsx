/** @jsxImportSource solid-js */

/**
 * Castmill Table View component.
 * Provides a common table view including pagination, searching, sorting, and selection.
 * (c) 2024 Castmill AB.
 */
import { JSX, Show, createEffect, createSignal, onMount } from 'solid-js';
import { Filter, ItemBase, Pagination, Table, TableAction, ToolBar } from '../';
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
}

type Params = Record<string, string>;
type SetParams = Record<string, string | number | boolean | null | undefined>;

interface TableViewProps<
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
> {
  title: string;
  resource: string;

  params?: [Partial<Params>, (params: SetParams, options?: any) => void]; // typeof useSearchParams;

  ref?: (ref: TableViewRef<IdType, Item>) => void;

  fetchData: (params: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => Promise<{ data: Item[]; count: number }>;

  table: {
    columns: {
      key: string;
      title: string;
      sortable?: boolean;
    }[];
    onSort?: (options: SortOptions) => void;
    actions?: TableAction<Item>[];
    actionsLabel?: string; // Label for the Actions column header
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
  };

  itemIdKey?: string;
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

  const [filters, setFilters] = createSignal<Filter[]>(
    props.toolbar?.filters || []
  );

  // If props.params is defined, it’s `[searchParams, setSearchParams]` from useSearchParams
  // Otherwise use reactive signals (or store) as a fallback
  const [fallbackParams, setFallbackParams] = createSignal<{
    page?: number;
    search?: string;
    filters?: string;
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
        sortOptions: {
          key: 'name',
          direction: 'ascending',
        },
        search,
        filters: filters().length ? filtersObject : undefined,
      });

      setData(result.data);
      setTotalItems(result.count);
    } catch (err) {
      console.log('error', err);
      setLoadingError(`Error fetching ${props.resource}: ${err}`);
    }
  };

  const handleChange = async (opts: {
    page?: number;
    search?: string;
    filters?: string;
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
  };

  if (props.ref) {
    props.ref(ref); // Assign the methods to the ref passed from the parent
  }

  return (
    <>
      <Show
        when={!loadingError()}
        fallback={<div>Loading Error: {loadingError()}</div>}
      >
        <div class={style['table-view']}>
          <Show when={props.toolbar}>
            <ToolBar
              title={props.title}
              filters={filters()}
              onFilterChange={handleFilterChange}
              initialSearchText={(getSearchParams().search as string) || ''}
              onSearch={handleSearch}
              mainAction={props.toolbar?.mainAction}
              actions={props.toolbar?.actions}
            />
          </Show>

          <Table<IdType, Item>
            columns={props.table.columns}
            data={data()}
            actions={props.table.actions}
            actionsLabel={props.table.actionsLabel}
            onRowSelect={props.table.onRowSelect}
            onSort={props.table.onSort}
            onRowClick={props.table.defaultRowAction?.handler}
            itemIdKey={props.itemIdKey}
            hideCheckboxes={props.table.hideCheckboxes}
          />

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
        </div>
      </Show>
    </>
  );
};
