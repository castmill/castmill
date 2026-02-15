import {
  Component,
  For,
  createSignal,
  createUniqueId,
  createMemo,
  JSX,
} from 'solid-js';
import { FaSolidSortDown } from 'solid-icons/fa';
import { FaSolidSortUp } from 'solid-icons/fa';
import { FaSolidSort } from 'solid-icons/fa';
import { SortOptions } from '../../interfaces/sort-options.interface';

import style from './table.module.scss';

export type ItemBase<IdType = string> = Record<string, any> & { id: IdType };

export interface Column<
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
> {
  key: string;
  title: string | (() => string); // Can be string or function for reactive translations
  sortable?: boolean;
  render?: (item: Item) => JSX.Element;
}

export interface TableAction<Item> {
  icon: Component | string;
  label: string | (() => string);
  props?: (item: Item) => Record<string, any>;
  handler: (item: Item) => void;
}

export interface TableProps<
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
> {
  columns: Column<IdType, Item>[] | (() => Column<IdType, Item>[]); // Can be array or function returning array
  data: Item[];
  onSort?: (options: SortOptions) => void;
  actions?: TableAction<Item>[] | (() => TableAction<Item>[]); // Can be array or function returning array
  actionsLabel?: string | (() => string); // Label for the Actions column header
  onRowSelect?: (selectedIds: Set<IdType>) => void;
  onRowClick?: (item: Item) => void;
  itemIdKey?: string;
  hideCheckboxes?: boolean;
  clearSelectionRef?: (fn: () => void) => void;
}

// Helper function to safely read nested properties using a dot path (e.g. "user.name")
function getValueByKeyPath<T extends Record<string, any>>(
  obj: T,
  path: string
): unknown {
  return path
    .split('.')
    .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

export const Table = <
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
>(
  props: TableProps<IdType, Item>
): JSX.Element => {
  // Generate a unique ID for this table instance to avoid checkbox ID conflicts
  const tableId = createUniqueId();
  const selectAllCheckboxId = `select-all-checkbox-${tableId}`;

  const [sortConfig, setSortConfig] = createSignal({
    key: undefined,
    direction: 'ascending',
  } as SortOptions);
  const [selectedRows, setSelectedRows] = createSignal(new Set<IdType>());

  // Expose a method for the parent to clear the selection
  props.clearSelectionRef?.(() => {
    setSelectedRows(new Set<IdType>());
  });

  const handleSort = async (key: string) => {
    const direction =
      sortConfig().key === key && sortConfig().direction === 'ascending'
        ? 'descending'
        : 'ascending';
    setSortConfig({ key, direction });

    if (props.onSort) {
      props.onSort({ key, direction });
    }
  };

  const sortIcon = (column: Column<IdType, Item>): JSX.Element => {
    if (sortConfig() && sortConfig().key === column.key) {
      return sortConfig().direction === 'ascending' ? (
        <FaSolidSortUp />
      ) : (
        <FaSolidSortDown />
      );
    }
    return column.sortable ? <FaSolidSort /> : <></>; // Empty fragment for non-sortable columns
  };

  const handleSelectRow = (id: IdType, isChecked: boolean) => {
    setSelectedRows((prevSelected) => {
      const newSet = new Set<IdType>(prevSelected);
      if (isChecked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      props.onRowSelect && props.onRowSelect(newSet);
      return newSet;
    });
  };

  const handleSelectAll = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const newSet = new Set<IdType>();
    if (target.checked) {
      for (const item of props.data) {
        newSet.add(getItemId(item));
      }
    }
    setSelectedRows(newSet);
    props.onRowSelect && props.onRowSelect(newSet);
  };

  const getItemId = (item: Item): IdType => item[props.itemIdKey || 'id'];

  // Helper to resolve column title - supports both string and function
  const getColumnTitle = (column: Column<IdType, Item>) =>
    typeof column.title === 'function' ? column.title() : column.title;

  // Helper to resolve action label - supports both string and function
  const getActionLabel = (action: TableAction<Item>) =>
    typeof action.label === 'function' ? action.label() : action.label;

  // Helper to resolve actions column label
  const getActionsColumnLabel = () =>
    typeof props.actionsLabel === 'function'
      ? props.actionsLabel()
      : props.actionsLabel;

  // Use createMemo to make columns reactive - this tracks changes when columns is a function
  const columns = createMemo(() =>
    typeof props.columns === 'function' ? props.columns() : props.columns
  );

  // Use createMemo to make actions reactive - this tracks changes when actions is a function
  const actions = createMemo(() =>
    typeof props.actions === 'function' ? props.actions() : props.actions
  );

  return (
    <div class={style['castmill-table']}>
      <table>
        <thead>
          <tr>
            {!props.hideCheckboxes && (
              <th class={style['checkbox-cell']}>
                {/* Simple checkbox container */}
                <input
                  type="checkbox"
                  id={selectAllCheckboxId}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                  title="Select items for bulk actions"
                  class={style['styled-checkbox']}
                />
                <label
                  for={selectAllCheckboxId}
                  aria-hidden="true"
                  class={style['checkbox-touch-target']}
                ></label>
              </th>
            )}
            <For each={columns()}>
              {(column) => (
                <th
                  onClick={() => column.sortable && handleSort(column.key)}
                  style={{ cursor: column.sortable ? 'pointer' : 'default' }}
                >
                  <div class={style['table-header-title']}>
                    {getColumnTitle(column)}
                    {sortIcon(column)}
                  </div>
                </th>
              )}
            </For>
            {actions() && <th>{getActionsColumnLabel() || 'Actions'}</th>}
          </tr>
        </thead>
        <tbody>
          <For each={props.data}>
            {(item) => (
              <tr
                onClick={(e) => {
                  // Don't trigger row click when clicking on checkbox or action buttons
                  if (
                    props.onRowClick &&
                    !(e.target as Element)?.closest('input[type="checkbox"]') &&
                    !(e.target as Element)?.closest(
                      `.${style['checkbox-touch-target']}`
                    ) &&
                    !(e.target as Element)?.closest('.table-actions')
                  ) {
                    props.onRowClick(item);
                  }
                }}
                style={{
                  cursor: props.onRowClick ? 'pointer' : 'default',
                }}
              >
                {!props.hideCheckboxes && (
                  <td class={style['checkbox-cell']}>
                    <input
                      type="checkbox"
                      id={`row-checkbox-${tableId}-${getItemId(item)}`}
                      checked={selectedRows().has(getItemId(item))}
                      onInput={(e) =>
                        handleSelectRow(getItemId(item), e.target.checked)
                      }
                      aria-label={`Select row ${getItemId(item)}`}
                      class={style['styled-checkbox']}
                    />
                    <label
                      for={`row-checkbox-${tableId}-${getItemId(item)}`}
                      aria-hidden="true"
                      class={style['checkbox-touch-target']}
                    ></label>
                  </td>
                )}
                <For each={columns()}>
                  {(column) => (
                    <td>
                      {column.render
                        ? column.render(item)
                        : (getValueByKeyPath(item, column.key) as JSX.Element)}
                    </td>
                  )}
                </For>
                {actions() && (
                  <td>
                    <div class={style['table-actions']}>
                      <For each={actions()}>
                        {(action) => (
                          <button
                            aria-label={`${getActionLabel(action)} ${item.name}`} // Providing an aria-label for accessibility and testing
                            onClick={(e) => {
                              e.stopPropagation();
                              action.handler(item);
                            }}
                          >
                            {typeof action.icon === 'function' ? (
                              <action.icon
                                {...(action.props ? action.props(item) : {})}
                              />
                            ) : (
                              action.icon
                            )}
                          </button>
                        )}
                      </For>
                    </div>
                  </td>
                )}
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
