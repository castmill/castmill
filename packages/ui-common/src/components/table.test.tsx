import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { CastmillTable } from './table';

describe('CastmillTable Component', () => {
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
      <CastmillTable
        columns={columns}
        data={data}
        fetchData={() => Promise.resolve()}
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
    render(() => (
      <CastmillTable
        columns={columns}
        data={data}
        fetchData={() => Promise.resolve()}
      />
    ));
    const checkbox = screen.getAllByRole('checkbox')[1]; // First row checkbox
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('calls onSort callback with correct options when a column header is clicked', () => {
    const mockOnSort = vi.fn();
    render(() => (
      <CastmillTable columns={columns} data={data} onSort={mockOnSort} />
    ));

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
    render(() => (
      <CastmillTable
        columns={columns}
        data={data}
        actions={actions}
        fetchData={() => Promise.resolve()}
      />
    ));
    const actionButton = screen.getByLabelText(`Edit ${data[0].name}`); // Adjust based on actual aria-label used
    fireEvent.click(actionButton);
    expect(actions[0].handler).toHaveBeenCalled();
  });
});
