import { Component, For, createSignal, createUniqueId, JSX } from 'solid-js';
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
  title: string;
  sortable?: boolean;
  render?: (item: Item) => JSX.Element;
}

export interface TableAction<Item> {
  icon: Component | string;
  label: string;
  props?: (item: Item) => Record<string, any>;
  handler: (item: Item) => void;
}

export interface TableProps<
  IdType = string,
  Item extends ItemBase<IdType> = ItemBase<IdType>,
> {
  columns: Column<IdType, Item>[]; // Make sure to pass both generics
  data: Item[];
  onSort?: (options: SortOptions) => void;
  actions?: TableAction<Item>[];
  actionsLabel?: string; // Label for the Actions column header
  onRowSelect?: (selectedIds: Set<IdType>) => void;
  onRowClick?: (item: Item) => void;
  itemIdKey?: string;
  hideCheckboxes?: boolean;
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
                  class={style['styled-checkbox']}
                />
                <label
                  for={selectAllCheckboxId}
                  aria-hidden="true"
                  class={style['checkbox-touch-target']}
                ></label>
              </th>
            )}
            <For each={props.columns}>
              {(column) => (
                <th
                  onClick={() => column.sortable && handleSort(column.key)}
                  style={{ cursor: column.sortable ? 'pointer' : 'default' }}
                >
                  <div class={style['table-header-title']}>
                    {column.title}
                    {sortIcon(column)}
                  </div>
                </th>
              )}
            </For>
            {props.actions && <th>{props.actionsLabel || 'Actions'}</th>}
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
                <For each={props.columns}>
                  {(column) => (
                    <td>
                      {column.render
                        ? column.render(item)
                        : (getValueByKeyPath(item, column.key) as JSX.Element)}
                    </td>
                  )}
                </For>
                {props.actions && (
                  <td>
                    <div class={style['table-actions']}>
                      <For each={props.actions}>
                        {(action) => (
                          <button
                            aria-label={`${action.label} ${item.name}`} // Providing an aria-label for accessibility and testing
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
