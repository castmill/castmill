import {
  Component,
  For,
  Show,
  createSignal,
  createUniqueId,
  createMemo,
  JSX,
  onCleanup,
} from 'solid-js';
import { BsThreeDots } from 'solid-icons/bs';
import { FaSolidSortDown } from 'solid-icons/fa';
import { FaSolidSortUp } from 'solid-icons/fa';
import { FaSolidSort } from 'solid-icons/fa';
import { SortOptions } from '../../interfaces/sort-options.interface';
import { MenuButton } from '../menu-button/menu-button';

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
  // Disables the action for rows it does not apply to.
  disabled?: (item: Item) => boolean;
  // Omits the action for a row, e.g. to show either "Block" or "Unblock".
  hidden?: (item: Item) => boolean;
}

type Label = string | (() => string);

/** Labels used by the stacked card layout. English defaults are used when omitted. */
export interface TableCardLabels {
  sortBy?: Label;
  sortAscending?: Label;
  sortDescending?: Label;
  selectAll?: Label;
  selectRow?: (id: string) => string;
}

/**
 * `compact` is used when the full table overflows its container: cells are
 * tighter and row actions move into a menu. `cards` requires `cardLayout`.
 */
export type TableLayout = 'table' | 'compact' | 'cards';

/** Default container width (in em) below which `cardLayout` tables render as cards. */
export const TABLE_CARD_BREAKPOINT_EM = 36;

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
  /**
   * Opt-in stacked card rendering when the table's container is narrower than
   * `cardBreakpoint` (em). The primary column becomes the card title, the other
   * columns label/value rows and the row actions a menu.
   */
  cardLayout?: boolean;
  /** Container width in em below which cards are rendered. Defaults to 36. */
  cardBreakpoint?: number;
  /** Column key used as the card title. Defaults to the first column. */
  cardPrimaryColumn?: string;
  cardLabels?: TableCardLabels;
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
      props.onRowSelect?.(newSet);
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
    props.onRowSelect?.(newSet);
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

  const resolveLabel = (label: Label | undefined, fallback: string) =>
    (typeof label === 'function' ? label() : label) || fallback;

  const cardLabel = (
    key: Exclude<keyof TableCardLabels, 'selectRow'>,
    fallback: string
  ) => resolveLabel(props.cardLabels?.[key], fallback);

  const renderCell = (column: Column<IdType, Item>, item: Item) =>
    column.render
      ? column.render(item)
      : (getValueByKeyPath(item, column.key) as JSX.Element);

  let rootRef: HTMLDivElement | undefined;
  let tableRef: HTMLTableElement | undefined;
  let tableObserver: ResizeObserver | undefined;
  let containerWidth = 0;
  // Table widths (px) that overflowed the container in each mode, used to
  // switch back once the container is wide enough again.
  let fullTableWidth = 0;
  let compactTableWidth = 0;
  let frame: number | undefined;

  const [layout, setLayout] = createSignal<TableLayout>('table');
  const showCards = () => !!props.cardLayout && layout() === 'cards';
  const isCompact = () => layout() === 'compact';

  const evaluateLayout = () => {
    if (!rootRef || containerWidth <= 0) {
      return;
    }
    const width = containerWidth;
    const fontSize = parseFloat(getComputedStyle(rootRef).fontSize) || 16;
    if (
      props.cardLayout &&
      width / fontSize < (props.cardBreakpoint ?? TABLE_CARD_BREAKPOINT_EM)
    ) {
      setLayout('cards');
      return;
    }

    const current = layout();
    if (current !== 'cards' && tableRef) {
      const needed = tableRef.offsetWidth;
      if (needed > width + 1) {
        if (current === 'table') {
          fullTableWidth = needed;
          setLayout('compact');
        } else if (props.cardLayout) {
          compactTableWidth = needed;
          setLayout('cards');
        }
        return;
      }
    }

    if (current === 'cards' || !props.cardLayout) {
      if (props.cardLayout && compactTableWidth > width) {
        setLayout('cards');
      } else {
        setLayout(fullTableWidth > width ? 'compact' : 'table');
      }
    } else if (current === 'compact' && fullTableWidth <= width) {
      setLayout('table');
    }
  };

  // Table resizes come from content changes or our own layout switches; run
  // them in the next frame so the DOM is not mutated inside the observer.
  const scheduleEvaluate = () => {
    if (typeof requestAnimationFrame !== 'function') {
      evaluateLayout();
      return;
    }
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      evaluateLayout();
    });
  };

  // Observers are attached from ref callbacks instead of onMount: dashboard
  // addons bundle their own Solid runtime and render without an owner, where
  // onMount runs before refs are assigned.
  const setRootRef = (el: HTMLDivElement) => {
    rootRef = el;
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      // Hidden containers (e.g. inactive tabs) report 0; keep the last layout.
      if (entry && entry.contentRect.width > 0) {
        containerWidth = entry.contentRect.width;
        evaluateLayout();
      }
    });
    observer.observe(el);
    tableObserver = new ResizeObserver(() => scheduleEvaluate());
    if (tableRef) {
      tableObserver.observe(tableRef);
    }
    const width = el.getBoundingClientRect().width;
    if (width > 0) {
      containerWidth = width;
      evaluateLayout();
    }
    onCleanup(() => {
      observer.disconnect();
      tableObserver?.disconnect();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    });
  };

  const setTableRef = (el: HTMLTableElement) => {
    if (tableRef && tableRef !== el) {
      tableObserver?.unobserve(tableRef);
    }
    tableRef = el;
    tableObserver?.observe(el);
  };

  const rowActions = (item: Item) =>
    (actions() || []).filter((action) => !action.hidden?.(item));

  const actionMenuItems = (item: Item) =>
    rowActions(item).map((action, index) => ({
      key: `action-${index}`,
      label: getActionLabel(action),
      disabled: action.disabled?.(item) ?? false,
      onClick: () => action.handler(item),
    }));

  const primaryColumn = createMemo(
    () =>
      columns().find((column) => column.key === props.cardPrimaryColumn) ||
      columns()[0]
  );

  const secondaryColumns = createMemo(() =>
    columns().filter((column) => column !== primaryColumn())
  );

  const sortableColumns = createMemo(() =>
    columns().filter((column) => column.sortable)
  );

  const applySort = (options: SortOptions) => {
    setSortConfig(options);
    props.onSort?.(options);
  };

  const allSelected = () =>
    props.data.length > 0 &&
    props.data.every((item) => selectedRows().has(getItemId(item)));

  const handleCardClick = (e: MouseEvent, item: Item) => {
    const target = e.target as Element | null;
    if (
      props.onRowClick &&
      !target?.closest(`input, button, select, a, label, [role="menu"]`) &&
      !target?.closest(`.${style['table-actions']}`)
    ) {
      props.onRowClick(item);
    }
  };

  const renderCards = () => (
    <>
      <Show when={!props.hideCheckboxes || sortableColumns().length > 0}>
        <div class={style['card-toolbar']}>
          <Show when={!props.hideCheckboxes}>
            <label class={style['card-select-all']}>
              <input
                type="checkbox"
                id={selectAllCheckboxId}
                checked={allSelected()}
                onChange={handleSelectAll}
                class={style['styled-checkbox']}
              />
              <span>{cardLabel('selectAll', 'Select all')}</span>
            </label>
          </Show>
          <Show when={sortableColumns().length > 0}>
            <div class={style['card-sort']}>
              <label for={`card-sort-${tableId}`}>
                {cardLabel('sortBy', 'Sort by')}
              </label>
              <select
                id={`card-sort-${tableId}`}
                value={sortConfig().key ?? ''}
                onChange={(e) =>
                  e.currentTarget.value &&
                  applySort({
                    key: e.currentTarget.value,
                    direction: sortConfig().direction,
                  })
                }
              >
                <Show when={!sortConfig().key}>
                  <option value="">—</option>
                </Show>
                <For each={sortableColumns()}>
                  {(column) => (
                    <option value={column.key}>{getColumnTitle(column)}</option>
                  )}
                </For>
              </select>
              <button
                type="button"
                class={style['card-sort-direction']}
                disabled={!sortConfig().key}
                aria-label={
                  sortConfig().direction === 'ascending'
                    ? cardLabel('sortAscending', 'Ascending')
                    : cardLabel('sortDescending', 'Descending')
                }
                title={
                  sortConfig().direction === 'ascending'
                    ? cardLabel('sortAscending', 'Ascending')
                    : cardLabel('sortDescending', 'Descending')
                }
                onClick={() =>
                  sortConfig().key &&
                  applySort({
                    key: sortConfig().key,
                    direction:
                      sortConfig().direction === 'ascending'
                        ? 'descending'
                        : 'ascending',
                  })
                }
              >
                {sortConfig().direction === 'ascending' ? (
                  <FaSolidSortUp />
                ) : (
                  <FaSolidSortDown />
                )}
              </button>
            </div>
          </Show>
        </div>
      </Show>
      <ul class={style['card-list']}>
        <For each={props.data}>
          {(item) => (
            <li
              class={style['card']}
              classList={{
                [style['selected']]: selectedRows().has(getItemId(item)),
                [style['clickable']]: !!props.onRowClick,
              }}
              data-testid="table-card"
              tabIndex={props.onRowClick ? 0 : undefined}
              onClick={(e) => handleCardClick(e, item)}
              onKeyDown={(e) => {
                if (
                  props.onRowClick &&
                  e.target === e.currentTarget &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  e.preventDefault();
                  props.onRowClick(item);
                }
              }}
            >
              <div class={style['card-header']}>
                <Show when={!props.hideCheckboxes}>
                  <label class={style['card-select']}>
                    <input
                      type="checkbox"
                      id={`row-checkbox-${tableId}-${getItemId(item)}`}
                      checked={selectedRows().has(getItemId(item))}
                      onInput={(e) =>
                        handleSelectRow(getItemId(item), e.target.checked)
                      }
                      aria-label={
                        props.cardLabels?.selectRow?.(
                          String(getItemId(item))
                        ) || `Select row ${getItemId(item)}`
                      }
                      class={style['styled-checkbox']}
                    />
                  </label>
                </Show>
                <div class={style['card-title']}>
                  <Show when={primaryColumn()}>
                    {(column) => renderCell(column(), item)}
                  </Show>
                </div>
                <Show when={rowActions(item).length}>
                  <div
                    class={`${style['table-actions']} ${style['card-actions']}`}
                  >
                    <MenuButton
                      size="small"
                      icon={BsThreeDots}
                      label={`${getActionsColumnLabel() || 'Actions'} ${item.name ?? ''}`.trim()}
                      items={actionMenuItems(item)}
                    />
                  </div>
                </Show>
              </div>
              <Show when={secondaryColumns().length > 0}>
                <dl class={style['card-fields']}>
                  <For each={secondaryColumns()}>
                    {(column) => (
                      <div class={style['card-field']}>
                        <dt>{getColumnTitle(column)}</dt>
                        <dd>{renderCell(column, item)}</dd>
                      </div>
                    )}
                  </For>
                </dl>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </>
  );

  return (
    <div
      ref={setRootRef}
      class={style['castmill-table']}
      classList={{
        [style['cards']]: showCards(),
        [style['compact']]: isCompact(),
      }}
      data-layout={showCards() ? 'cards' : 'table'}
      data-density={isCompact() ? 'compact' : 'regular'}
    >
      <Show when={!showCards()} fallback={renderCards()}>
        <table ref={setTableRef}>
          <thead>
            <tr>
              {!props.hideCheckboxes && (
                <th class={style['checkbox-cell']}>
                  {/* Simple checkbox container */}
                  <input
                    type="checkbox"
                    id={selectAllCheckboxId}
                    checked={allSelected()}
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
                      !(e.target as Element)?.closest(
                        'input[type="checkbox"]'
                      ) &&
                      !(e.target as Element)?.closest(
                        `.${style['checkbox-touch-target']}`
                      ) &&
                      !(e.target as Element)?.closest(
                        `.${style['table-actions']}`
                      )
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
                    {(column) => <td>{renderCell(column, item)}</td>}
                  </For>
                  {actions() && (
                    <td>
                      <Show
                        when={!isCompact()}
                        fallback={
                          <div
                            class={`${style['table-actions']} ${style['table-actions-menu']}`}
                          >
                            <MenuButton
                              size="small"
                              icon={BsThreeDots}
                              label={`${getActionsColumnLabel() || 'Actions'} ${item.name ?? ''}`.trim()}
                              items={actionMenuItems(item)}
                            />
                          </div>
                        }
                      >
                        <div class={style['table-actions']}>
                          <For each={rowActions(item)}>
                            {(action) => (
                              <button
                                aria-label={`${getActionLabel(action)} ${item.name ?? ''}`.trim()} // Providing an aria-label for accessibility and testing
                                disabled={action.disabled?.(item) ?? false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!action.disabled?.(item)) {
                                    action.handler(item);
                                  }
                                }}
                              >
                                {typeof action.icon === 'function' ? (
                                  <action.icon
                                    {...(action.props
                                      ? action.props(item)
                                      : {})}
                                  />
                                ) : (
                                  action.icon
                                )}
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                    </td>
                  )}
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
};
