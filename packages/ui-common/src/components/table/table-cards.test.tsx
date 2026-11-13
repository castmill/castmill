/** @jsxImportSource solid-js */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  fireEvent,
  cleanup,
  screen,
  within,
} from '@solidjs/testing-library';
import { Table, TABLE_CARD_BREAKPOINT_EM } from './table';
import { createSignal } from 'solid-js';

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;

let observers: MockResizeObserver[] = [];

class MockResizeObserver {
  callback: ResizeCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }
}

const resizeTo = (width: number) => {
  observers.forEach((observer) =>
    observer.callback([{ contentRect: { width } }])
  );
};

const PHONE_WIDTH = 375;
const DESKTOP_WIDTH = 1440;

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: () => 'Role', sortable: true },
  { key: 'user.email', title: 'Email' },
];

const data = [
  { id: '1', name: 'John Doe', role: 'admin', user: { email: 'j@x.io' } },
  { id: '2', name: 'Jane Smith', role: 'member', user: { email: 'n@x.io' } },
];

const layoutOf = (container: HTMLElement) =>
  container.querySelector('[data-layout]')?.getAttribute('data-layout');

describe('Table card layout', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders a regular table when cardLayout is not enabled', () => {
    const { container } = render(() => <Table columns={columns} data={data} />);
    expect(observers).toHaveLength(0);
    resizeTo(PHONE_WIDTH);
    expect(layoutOf(container)).toBe('table');
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('switches between cards and table based on container width', () => {
    const { container } = render(() => (
      <Table columns={columns} data={data} cardLayout />
    ));

    expect(observers).toHaveLength(1);
    expect(observers[0].observed[0]).toBe(
      container.querySelector('[data-layout]')
    );

    resizeTo(PHONE_WIDTH);
    expect(layoutOf(container)).toBe('cards');
    expect(container.querySelector('table')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('table-card')).toHaveLength(2);

    // Tablet portrait (768px) is wider than the default 36em breakpoint
    resizeTo(768);
    expect(layoutOf(container)).toBe('table');

    resizeTo(DESKTOP_WIDTH);
    expect(layoutOf(container)).toBe('table');
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('uses the wrapper width and font size for the initial measurement', () => {
    const bounds = vi
      .spyOn(HTMLDivElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 650 } as DOMRect);
    const getComputedStyle = window.getComputedStyle;
    const computedStyle = vi
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((element, pseudo) =>
        element.hasAttribute('data-layout')
          ? ({ fontSize: '20px' } as CSSStyleDeclaration)
          : getComputedStyle(element, pseudo)
      );
    const { container } = render(() => (
      <Table columns={columns} data={data} cardLayout />
    ));

    const root = container.querySelector('[data-layout]');
    expect(layoutOf(container)).toBe('cards');
    expect(computedStyle).toHaveBeenCalledWith(root);

    bounds.mockRestore();
    computedStyle.mockRestore();
  });

  it('keeps the current layout when the container is hidden (0 width)', () => {
    const { container } = render(() => (
      <Table columns={columns} data={data} cardLayout />
    ));
    resizeTo(PHONE_WIDTH);
    resizeTo(0);
    expect(layoutOf(container)).toBe('cards');
  });

  it('honours a custom breakpoint', () => {
    const { container } = render(() => (
      <Table columns={columns} data={data} cardLayout cardBreakpoint={60} />
    ));
    resizeTo(TABLE_CARD_BREAKPOINT_EM * 16 + 100);
    expect(layoutOf(container)).toBe('cards');
    resizeTo(60 * 16);
    expect(layoutOf(container)).toBe('table');
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(() => (
      <Table columns={columns} data={data} cardLayout />
    ));
    unmount();
    expect(observers[0].disconnected).toBe(true);
  });

  it('falls back to the table when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { container } = render(() => (
      <Table columns={columns} data={data} cardLayout />
    ));
    expect(layoutOf(container)).toBe('table');
  });

  it('renders the primary column as title and others as label/value rows', () => {
    render(() => <Table columns={columns} data={data} cardLayout />);
    resizeTo(PHONE_WIDTH);

    const [first] = screen.getAllByTestId('table-card');
    const title = first.querySelector('[class*="card-title"]');
    expect(title).toHaveTextContent('John Doe');

    const labels = Array.from(first.querySelectorAll('dt')).map(
      (dt) => dt.textContent
    );
    const values = Array.from(first.querySelectorAll('dd')).map(
      (dd) => dd.textContent
    );
    expect(labels).toEqual(['Role', 'Email']);
    expect(values).toEqual(['admin', 'j@x.io']);
  });

  it('uses cardPrimaryColumn and custom renderers', () => {
    render(() => (
      <Table
        columns={[
          ...columns,
          {
            key: 'badge',
            title: 'Badge',
            render: (item) => <strong>{item.name.toUpperCase()}</strong>,
          },
        ]}
        data={data}
        cardLayout
        cardPrimaryColumn="role"
      />
    ));
    resizeTo(PHONE_WIDTH);

    const [first] = screen.getAllByTestId('table-card');
    expect(first.querySelector('[class*="card-title"]')).toHaveTextContent(
      'admin'
    );
    expect(within(first).getByText('JOHN DOE').tagName).toBe('STRONG');
    expect(within(first).getByText('Name')).toBeInTheDocument();
  });

  it('omits the field list when there is only one column', () => {
    render(() => (
      <Table columns={[columns[0]]} data={data} cardLayout hideCheckboxes />
    ));
    resizeTo(PHONE_WIDTH);
    const [first] = screen.getAllByTestId('table-card');
    expect(first.querySelector('dl')).not.toBeInTheDocument();
  });

  it('exposes row actions through a menu', async () => {
    const edit = vi.fn();
    const remove = vi.fn();
    render(() => (
      <Table
        columns={columns}
        data={data}
        cardLayout
        actionsLabel={() => 'Acciones'}
        actions={[
          { icon: 'E', label: 'Edit', handler: edit },
          {
            icon: 'R',
            label: () => 'Remove',
            handler: remove,
            disabled: (item) => item.id === '2',
          },
        ]}
      />
    ));
    resizeTo(PHONE_WIDTH);

    const [first, second] = screen.getAllByTestId('table-card');

    await fireEvent.click(
      within(first).getByRole('button', { name: /Acciones/ })
    );
    await fireEvent.click(
      within(first).getByRole('menuitem', { name: 'Edit' })
    );
    expect(edit).toHaveBeenCalledWith(data[0]);

    await fireEvent.click(
      within(second).getByRole('button', { name: /Acciones/ })
    );
    const removeItem = within(second).getByRole('menuitem', { name: 'Remove' });
    expect(removeItem).toBeDisabled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('defaults the action menu label to "Actions"', () => {
    render(() => (
      <Table
        columns={columns}
        data={data}
        cardLayout
        actions={[{ icon: 'E', label: 'Edit', handler: vi.fn() }]}
      />
    ));
    resizeTo(PHONE_WIDTH);
    expect(screen.getAllByRole('button', { name: /Actions/ })).toHaveLength(2);
  });

  it('handles card clicks and keyboard activation without hijacking controls', async () => {
    const onRowClick = vi.fn();
    const onRowSelect = vi.fn();
    render(() => (
      <Table
        columns={columns}
        data={data}
        cardLayout
        onRowClick={onRowClick}
        onRowSelect={onRowSelect}
        actions={[{ icon: 'E', label: 'Edit', handler: vi.fn() }]}
      />
    ));
    resizeTo(PHONE_WIDTH);

    const [first] = screen.getAllByTestId('table-card');
    expect(first).toHaveAttribute('tabindex', '0');

    await fireEvent.click(within(first).getByText('admin'));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);

    await fireEvent.keyDown(first, { key: 'Enter' });
    await fireEvent.keyDown(first, { key: ' ' });
    await fireEvent.keyDown(first, { key: 'a' });
    expect(onRowClick).toHaveBeenCalledTimes(3);

    // Key presses on nested controls are ignored
    const checkbox = within(first).getByRole('checkbox');
    await fireEvent.keyDown(checkbox, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(3);

    await fireEvent.click(checkbox);
    expect(onRowClick).toHaveBeenCalledTimes(3);
    expect(onRowSelect).toHaveBeenLastCalledWith(new Set(['1']));
    expect(first.className).toMatch(/selected/);

    await fireEvent.click(
      within(first).getByRole('button', { name: /Actions/ })
    );
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  it('is not focusable without a row click handler', () => {
    render(() => <Table columns={columns} data={data} cardLayout />);
    resizeTo(PHONE_WIDTH);
    const [first] = screen.getAllByTestId('table-card');
    expect(first).not.toHaveAttribute('tabindex');
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'Enter' });
  });

  it('supports select all with localized labels and keeps it in sync', async () => {
    const onRowSelect = vi.fn();
    let clear: (() => void) | undefined;
    render(() => (
      <Table
        columns={columns}
        data={data}
        cardLayout
        onRowSelect={onRowSelect}
        clearSelectionRef={(fn) => (clear = fn)}
        cardLabels={{ selectAll: () => 'Seleccionar todo' }}
      />
    ));
    resizeTo(PHONE_WIDTH);

    const selectAll = screen.getByLabelText('Seleccionar todo');
    expect(selectAll).not.toBeChecked();

    await fireEvent.click(selectAll);
    expect(onRowSelect).toHaveBeenLastCalledWith(new Set(['1', '2']));
    expect(selectAll).toBeChecked();
    screen
      .getAllByRole('checkbox', { name: /Select row/ })
      .forEach((checkbox) => expect(checkbox).toBeChecked());

    // Deselecting one row unchecks "select all"
    await fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select row 1' })
    );
    expect(selectAll).not.toBeChecked();

    clear?.();
    await Promise.resolve();
    screen
      .getAllByRole('checkbox', { name: /Select row/ })
      .forEach((checkbox) => expect(checkbox).not.toBeChecked());
  });

  it('updates localized row labels with the row ID and locale', () => {
    const [spanish, setSpanish] = createSignal(false);
    render(() => (
      <Table
        columns={[{ key: 'name', title: 'Name' }]}
        data={[{ id: 42, name: 'Example' }]}
        cardLayout
        cardLabels={{
          selectRow: (id) => (spanish() ? `Fila ${id}` : `Row ${id}`),
        }}
      />
    ));
    resizeTo(PHONE_WIDTH);
    expect(
      screen.getByRole('checkbox', { name: 'Row 42' })
    ).toBeInTheDocument();
    setSpanish(true);
    expect(
      screen.getByRole('checkbox', { name: 'Fila 42' })
    ).toBeInTheDocument();
  });

  it('synchronizes select all when switching layouts and changing selection', async () => {
    const onRowSelect = vi.fn();
    let clear: (() => void) | undefined;
    render(() => (
      <Table
        columns={columns}
        data={data}
        cardLayout
        onRowSelect={onRowSelect}
        clearSelectionRef={(fn) => (clear = fn)}
      />
    ));

    resizeTo(PHONE_WIDTH);
    await fireEvent.click(screen.getByLabelText('Select all'));
    resizeTo(DESKTOP_WIDTH);
    const tableSelectAll = screen.getByLabelText('Select all rows');
    expect(tableSelectAll).toBeChecked();
    await fireEvent.click(tableSelectAll);
    expect(onRowSelect).toHaveBeenLastCalledWith(new Set());
    expect(tableSelectAll).not.toBeChecked();

    await fireEvent.click(screen.getByLabelText('Select row 1'));
    expect(tableSelectAll).not.toBeChecked();
    await fireEvent.click(screen.getByLabelText('Select row 2'));
    expect(tableSelectAll).toBeChecked();
    resizeTo(PHONE_WIDTH);
    expect(screen.getByLabelText('Select all')).toBeChecked();
    clear?.();
    expect(screen.getByLabelText('Select all')).not.toBeChecked();
    resizeTo(DESKTOP_WIDTH);
    expect(screen.getByLabelText('Select all rows')).not.toBeChecked();
  });

  it('sorts through the sort select and direction toggle', async () => {
    const onSort = vi.fn();
    render(() => (
      <Table
        columns={columns}
        data={data}
        cardLayout
        onSort={onSort}
        cardLabels={{
          sortBy: 'Ordenar por',
          sortAscending: 'Ascendente',
          sortDescending: 'Descendente',
        }}
      />
    ));
    resizeTo(PHONE_WIDTH);

    const select = screen.getByLabelText('Ordenar por') as HTMLSelectElement;
    // Only sortable columns are offered, plus an empty placeholder
    expect(
      Array.from(select.options).map((option) => option.textContent)
    ).toEqual(['—', 'Name', 'Role']);

    const toggle = screen.getByRole('button', { name: 'Ascendente' });
    expect(toggle).toBeDisabled();

    select.value = 'role';
    await fireEvent.change(select);
    expect(onSort).toHaveBeenLastCalledWith({
      key: 'role',
      direction: 'ascending',
    });
    expect(toggle).not.toBeDisabled();
    expect(select.options).toHaveLength(2);

    await fireEvent.click(toggle);
    expect(onSort).toHaveBeenLastCalledWith({
      key: 'role',
      direction: 'descending',
    });
    expect(toggle).toHaveAccessibleName('Descendente');

    await fireEvent.click(toggle);
    expect(onSort).toHaveBeenLastCalledWith({
      key: 'role',
      direction: 'ascending',
    });
  });

  it('uses English defaults and hides the toolbar when nothing applies', () => {
    const { container, unmount } = render(() => (
      <Table columns={columns} data={data} cardLayout />
    ));
    resizeTo(PHONE_WIDTH);
    expect(screen.getByLabelText('Select all')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ascending' })
    ).toBeInTheDocument();
    unmount();

    observers = [];
    const { container: bare } = render(() => (
      <Table
        columns={[{ key: 'name', title: 'Name' }]}
        data={data}
        cardLayout
        hideCheckboxes
      />
    ));
    resizeTo(PHONE_WIDTH);
    expect(bare.querySelector('[class*="card-toolbar"]')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(container).toBeDefined();
  });
});
