/** @jsxImportSource solid-js */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { Table } from './table';

describe('Table Component', () => {
  afterEach(() => cleanup());

  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'age', title: 'Age', sortable: false },
  ];

  const data = [
    { id: '1', name: 'John Doe', age: 30 },
    { id: '2', name: 'Jane Smith', age: 25 },
  ];

  const actions = [
    {
      icon: 'Edit',
      label: 'Edit',
      handler: vi.fn(),
    },
  ];

  it('renders correctly with data and columns', () => {
    render(() => (
      <Table
        columns={columns}
        data={data}
        actions={[
          {
            icon: 'Edit',
            label: 'Edit',
            handler: () => {},
          },
        ]}
      />
    ));

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    // Using getByLabelText to find buttons with aria-labels
    const editButtons = screen.getAllByLabelText(/^Edit/);
    expect(editButtons.length).toBe(2);
  });

  it('handles row selection correctly', async () => {
    render(() => <Table columns={columns} data={data} />);
    const checkbox = screen.getAllByRole('checkbox')[1]; // First row checkbox
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('calls onSort callback with correct options when a column header is clicked', () => {
    const mockOnSort = vi.fn();
    render(() => <Table columns={columns} data={data} onSort={mockOnSort} />);

    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader); // Trigger sorting by name
    expect(mockOnSort).toHaveBeenCalledWith({
      key: 'name',
      direction: 'ascending',
    });

    fireEvent.click(nameHeader); // Trigger sorting by name again to toggle direction
    expect(mockOnSort).toHaveBeenCalledWith({
      key: 'name',
      direction: 'descending',
    });
  });

  it('executes action on button click', async () => {
    render(() => <Table columns={columns} data={data} actions={actions} />);
    const actionButton = screen.getByLabelText(`Edit ${data[0].name}`); // Adjust based on actual aria-label used
    fireEvent.click(actionButton);
    expect(actions[0].handler).toHaveBeenCalled();
  });

  it('calls onRowClick when a row is clicked', async () => {
    const mockOnRowClick = vi.fn();
    render(() => (
      <Table columns={columns} data={data} onRowClick={mockOnRowClick} />
    ));

    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row (index 0 is header)
    fireEvent.click(dataRow);

    expect(mockOnRowClick).toHaveBeenCalledWith(data[0]);
  });

  it('does not call onRowClick when checkbox is clicked', async () => {
    const mockOnRowClick = vi.fn();
    render(() => (
      <Table columns={columns} data={data} onRowClick={mockOnRowClick} />
    ));

    const checkbox = screen.getAllByRole('checkbox')[1]; // First row checkbox
    fireEvent.click(checkbox);

    expect(mockOnRowClick).not.toHaveBeenCalled();
  });

  it('does not call onRowClick when checkbox label is clicked', async () => {
    const mockOnRowClick = vi.fn();
    const { container } = render(() => (
      <Table columns={columns} data={data} onRowClick={mockOnRowClick} />
    ));

    // Find the label element (the touch target) for the first row checkbox
    // The label's "for" attribute contains the row ID pattern
    const label = container.querySelector(
      'label[for^="row-checkbox-"][for$="-1"]'
    );
    expect(label).toBeInTheDocument();

    fireEvent.click(label!);

    expect(mockOnRowClick).not.toHaveBeenCalled();
  });

  it('does not call onRowClick when action button is clicked', async () => {
    const mockOnRowClick = vi.fn();
    render(() => (
      <Table
        columns={columns}
        data={data}
        actions={actions}
        onRowClick={mockOnRowClick}
      />
    ));

    const actionButton = screen.getByLabelText(`Edit ${data[0].name}`);
    fireEvent.click(actionButton);

    expect(mockOnRowClick).not.toHaveBeenCalled();
    expect(actions[0].handler).toHaveBeenCalled();
  });

  it('sets cursor to pointer when onRowClick is provided', () => {
    const mockOnRowClick = vi.fn();
    render(() => (
      <Table columns={columns} data={data} onRowClick={mockOnRowClick} />
    ));

    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row
    expect(dataRow).toHaveStyle('cursor: pointer');
  });

  it('sets cursor to default when onRowClick is not provided', () => {
    render(() => <Table columns={columns} data={data} />);

    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row
    expect(dataRow).toHaveStyle('cursor: default');
  });
});
