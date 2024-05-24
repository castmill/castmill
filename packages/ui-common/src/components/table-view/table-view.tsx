/** @jsxImportSource solid-js */

/**
 * Castmill Table View component.
 * Provides a common table view including pagination, searching, sorting, and selection.
 * (c) 2024 Castmill AB.
 */
import { JSX, Show, createEffect, createSignal, onMount } from 'solid-js';
import {
  ToolBar,
  ItemBase,
  TableProps,
  Table,
  Pagination,
  Filter,
  TableAction,
} from '../';
import { SortOptions } from '../../interfaces/sort-options.interface';

import style from './table-view.module.scss';

export interface TableViewRef<Item extends ItemBase> {
  reloadData: () => Promise<void>;
  updateItem: (itemId: string, item: Item) => void;
}

interface TableViewProps<Item extends ItemBase> extends TableProps<Item> {
  title: string;
  resource: string;

  params?: any; // typeof useSearchParams;

  ref?: (ref: TableViewRef<Item>) => void;

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
    onSort: (options: SortOptions) => void;
    actions?: TableAction[];
    onRowSelect?: (selectedIds: Set<string>) => void;
  };

  pagination: {
    itemsPerPage: number;
  };

  toolbar?: {
    filters?: Filter[];
    mainAction?: JSX.Element;
    actions?: JSX.Element;
  };
}

export const TableView = <Item extends ItemBase>(
  props: TableViewProps<Item>
): JSX.Element => {
  const [data, setData] = createSignal<Item[]>([]);

  const [currentPage, setCurrentPage] = createSignal(1);
  const [totalItems, setTotalItems] = createSignal(0);

  const [loadingError, setLoadingError] = createSignal('');

  const [filters, setFilters] = createSignal<Filter[]>(
    props.toolbar?.filters || []
  );

  const [searchParams, setSearchParams] = props.params || [{} as any, () => {}];

  onMount(() => {
    // Get initial filters from search params
    const initialFilters = searchParams.filters;

    if (initialFilters) {
      filters().forEach((filter) => {
        filter.isActive = initialFilters.includes(filter.key);
      });
    }
  });

  const activeFilters = () =>
    filters()
      .filter((filter: { isActive: boolean }) => filter.isActive)
      .map((filter: { key: string }) => filter.key);

  const updateData = async () => {
    const search = searchParams.search;

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

  createEffect(async () => {
    await updateData();
  });

  const handlePageChange = async (newPage: number) => {
    setTimeout(async () => {
      if (newPage != currentPage()) {
        setCurrentPage(newPage);
        setSearchParams({ ...searchParams, page: newPage });
      }
      await updateData();
    }, 0);
  };

  const handleSearch = async (search: string) => {
    if (search === searchParams['search']) {
      return;
    }

    // As we are changing the search, we need to reset the page to 1
    setCurrentPage(1);
    setSearchParams({ ...searchParams, search, page: 1 });
    await handlePageChange(1);
  };

  const updateFiltersParams = () => {
    setSearchParams({
      ...searchParams,
      filters: activeFilters().join(','), // Unfortunatelly the , gets encoded to %2C
    });
  };

  const handleFilterChange = (updatedFilters: Filter[]) => {
    setFilters(updatedFilters);

    // As we are changing the filters, we need to reset the page to 1
    setCurrentPage(1);
    updateFiltersParams();
    handlePageChange(currentPage());
  };

  const ref = {
    reloadData: async () => {
      await updateData();
    },
    updateItem: (itemId: string, item: Partial<Item>) => {
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
        <Show when={props.toolbar}>
          <ToolBar
            title={props.title}
            filters={filters()}
            onFilterChange={handleFilterChange}
            initialSearchText={searchParams.search || ''}
            onSearch={handleSearch}
            mainAction={props.toolbar?.mainAction}
            actions={props.toolbar?.actions}
          />
        </Show>

        <Table<Item>
          columns={props.table.columns}
          data={data()}
          actions={props.table.actions}
          onRowSelect={props.table.onRowSelect}
          onSort={props.table.onSort}
        />

        <div class={style['pagination-wrapper']}>
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
      </Show>
    </>
  );
};
