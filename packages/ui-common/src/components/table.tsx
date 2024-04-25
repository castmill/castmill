import { Component, For, createSignal, JSX } from 'solid-js';
import { FaSolidSortDown } from 'solid-icons/fa';
import { FaSolidSortUp } from 'solid-icons/fa';
import { FaSolidSort } from 'solid-icons/fa';
import { SortOptions } from '../interfaces/sort-options.interface';

type ItemBase = Record<string, any> & { id: string };

export interface Column<Item extends ItemBase> {
  key: string;
  title: string;
  sortable?: boolean;
  render?: (item: Item) => JSX.Element;
}

export interface TableProps<Item extends ItemBase> {
  columns: Column<Item>[];
  data: Item[];
  onSort: (options: SortOptions) => void;
  actions?: {
    icon: Component | string;
    label: string;
    props?: (item: Item) => Record<string, any>;
    handler: (item: Item) => void;
  }[];
}

export const CastmillTable = <Item extends ItemBase>(
  props: TableProps<Item>
): JSX.Element => {
  const [sortConfig, setSortConfig] = createSignal({
    key: undefined,
    direction: 'ascending',
  } as SortOptions);
  const [selectedRows, setSelectedRows] = createSignal(new Set());

  const handleSort = async (key: string) => {
    const direction =
      sortConfig().key === key && sortConfig().direction === 'ascending'
        ? 'descending'
        : 'ascending';
    setSortConfig({ key, direction });
    props.onSort({ key, direction });
  };

  const sortIcon = (column: Column<any>): JSX.Element => {
    if (sortConfig() && sortConfig().key === column.key) {
      return sortConfig().direction === 'ascending' ? (
        <FaSolidSortUp />
      ) : (
        <FaSolidSortDown />
      );
    }
    return column.sortable ? <FaSolidSort /> : <></>; // Empty fragment for non-sortable columns
  };

  const handleSelectRow = (id: string, isChecked: boolean) => {
    setSelectedRows((prevSelected) => {
      const newSet = new Set(prevSelected);
      if (isChecked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const newSet = new Set<string>();
    if (target.checked) {
      for (const item of props.data) {
        newSet.add(item.id);
      }
    }
    setSelectedRows(newSet);
  };

  return (
    <table>
      <thead>
        <tr>
          <th>
            <input type="checkbox" onChange={handleSelectAll} />
          </th>
          <For each={props.columns}>
            {(column) => (
              <th
                onClick={() => column.sortable && handleSort(column.key)}
                style={{ cursor: column.sortable ? 'pointer' : 'default' }}
              >
                <div class="table-header-title">
                  {column.title}
                  {sortIcon(column)}
                </div>
              </th>
            )}
          </For>
          {props.actions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        <For each={props.data}>
          {(item) => (
            <tr>
              <td>
                <input
                  type="checkbox"
                  checked={selectedRows().has(item.id)}
                  onInput={(e) => handleSelectRow(item.id, e.target.checked)}
                />
              </td>
              <For each={props.columns}>
                {(column) => (
                  <td>
                    {column.render ? column.render(item) : item[column.key]}
                  </td>
                )}
              </For>
              {props.actions && (
                <td>
                  <div class="table-actions">
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
  );
};
