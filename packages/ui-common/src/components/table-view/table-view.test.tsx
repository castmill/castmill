/** @jsxImportSource solid-js */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  fireEvent,
  cleanup,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { TableView } from './table-view';
import { BsEye } from 'solid-icons/bs';

describe('TableView Component - Default Row Action', () => {
  afterEach(() => cleanup());

  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'type', title: 'Type', sortable: false },
  ];

  const mockData = [
    { id: '1', name: 'Resource 1', type: 'Image' },
    { id: '2', name: 'Resource 2', type: 'Video' },
  ];

  const mockFetchData = vi.fn().mockResolvedValue({
    data: mockData,
    count: 2,
  });

  const mockDefaultAction = vi.fn();

  const defaultProps = {
    title: 'Test Resources',
    resource: 'resources',
    fetchData: mockFetchData,
    table: {
      columns,
    },
    pagination: {
      itemsPerPage: 10,
    },
  };

  it('renders TableView with default row action', async () => {
    const propsWithDefaultAction = {
      ...defaultProps,
      table: {
        ...defaultProps.table,
        defaultRowAction: {
          icon: BsEye,
          handler: mockDefaultAction,
          label: 'View',
        },
      },
    };

    render(() => <TableView {...propsWithDefaultAction} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Check that rows have pointer cursor (indicating row click is enabled)
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row (header is index 0)
    expect(dataRow).toHaveStyle('cursor: pointer');
  });

  it('calls defaultRowAction handler when row is clicked', async () => {
    const propsWithDefaultAction = {
      ...defaultProps,
      table: {
        ...defaultProps.table,
        defaultRowAction: {
          icon: BsEye,
          handler: mockDefaultAction,
          label: 'View',
        },
      },
    };

    render(() => <TableView {...propsWithDefaultAction} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Click on the first data row
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row
    fireEvent.click(dataRow);

    // Verify the defaultRowAction handler was called with the correct item
    expect(mockDefaultAction).toHaveBeenCalledWith(mockData[0]);
  });

  it('works without default row action (backwards compatibility)', async () => {
    render(() => <TableView {...defaultProps} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Check that rows have default cursor (no row click enabled)
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row
    expect(dataRow).toHaveStyle('cursor: default');
  });

  it('integrates defaultRowAction with existing actions', async () => {
    const mockEditAction = vi.fn();
    const propsWithAllActions = {
      ...defaultProps,
      table: {
        ...defaultProps.table,
        actions: [
          {
            icon: 'Edit',
            handler: mockEditAction,
            label: 'Edit',
          },
        ],
        defaultRowAction: {
          icon: BsEye,
          handler: mockDefaultAction,
          label: 'View',
        },
      },
    };

    render(() => <TableView {...propsWithAllActions} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Clear any calls that might have happened during setup
    mockEditAction.mockClear();
    mockDefaultAction.mockClear();

    // Test that action buttons work independently and don't trigger row click
    const editButton = screen.getByLabelText('Edit Resource 1');
    fireEvent.click(editButton);

    // The edit action should be called
    expect(mockEditAction).toHaveBeenCalledWith(mockData[0]);
    // The default action should NOT be called when clicking the edit button
    expect(mockDefaultAction).not.toHaveBeenCalled();

    // Reset mocks again
    mockEditAction.mockClear();
    mockDefaultAction.mockClear();

    // Test that row click works for default action
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // First data row
    fireEvent.click(dataRow);

    // The default action should be called
    expect(mockDefaultAction).toHaveBeenCalledWith(mockData[0]);
    // The edit action should NOT be called when clicking the row
    expect(mockEditAction).not.toHaveBeenCalled();
  });

  it('demonstrates the complete feature integration', async () => {
    // This test demonstrates the full workflow of the new feature
    const mockViewHandler = vi.fn();
    const mockEditHandler = vi.fn();
    const mockRowSelectHandler = vi.fn();

    const completeProps = {
      title: 'Complete Feature Demo',
      resource: 'resources',
      fetchData: mockFetchData,
      table: {
        columns,
        actions: [
          {
            icon: BsEye,
            handler: mockViewHandler,
            label: 'View',
          },
          {
            icon: 'Edit',
            handler: mockEditHandler,
            label: 'Edit',
          },
        ],
        onRowSelect: mockRowSelectHandler,
        // The key feature: defaultRowAction that matches the "View" action
        defaultRowAction: {
          icon: BsEye,
          handler: mockViewHandler,
          label: 'View',
        },
      },
      pagination: {
        itemsPerPage: 10,
      },
    };

    render(() => <TableView {...completeProps} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Clear any calls that might have happened during setup
    mockViewHandler.mockClear();
    mockEditHandler.mockClear();
    mockRowSelectHandler.mockClear();

    // Demonstrate that the View button and row click trigger the same handler
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1];

    // Test row click triggers view handler
    fireEvent.click(dataRow);
    expect(mockViewHandler).toHaveBeenCalledWith(mockData[0]);
    expect(mockEditHandler).not.toHaveBeenCalled();

    // Reset
    mockViewHandler.mockClear();

    // Test that View button also triggers same handler
    const viewButton = screen.getByLabelText('View Resource 1');
    fireEvent.click(viewButton);
    expect(mockViewHandler).toHaveBeenCalledWith(mockData[0]);
    expect(mockEditHandler).not.toHaveBeenCalled();

    // Reset
    mockViewHandler.mockClear();

    // Verify Edit button still works independently
    const editButton = screen.getByLabelText('Edit Resource 1');
    fireEvent.click(editButton);
    expect(mockEditHandler).toHaveBeenCalledWith(mockData[0]);
    expect(mockViewHandler).not.toHaveBeenCalled();

    // Verify checkbox selection still works independently
    const checkbox = screen.getAllByRole('checkbox')[1]; // First data row checkbox
    fireEvent.click(checkbox);
    expect(mockRowSelectHandler).toHaveBeenCalled();

    // Clicking checkbox should not trigger view action
    expect(mockViewHandler).not.toHaveBeenCalled();
  });
});

describe('TableView Component - Sorting Functionality', () => {
  afterEach(() => cleanup());

  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'created', title: 'Created', sortable: true },
    { key: 'type', title: 'Type', sortable: false },
  ];

  const mockData = [
    { id: '1', name: 'Resource A', type: 'Image', created: '2024-01-01' },
    { id: '2', name: 'Resource B', type: 'Video', created: '2024-01-02' },
  ];

  const mockFetchData = vi.fn().mockResolvedValue({
    data: mockData,
    count: 2,
  });

  const defaultProps = {
    title: 'Test Resources',
    resource: 'resources',
    fetchData: mockFetchData,
    table: {
      columns,
    },
    pagination: {
      itemsPerPage: 10,
    },
  };

  it('calls fetchData with initial sort options', async () => {
    render(() => <TableView {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalled();
    });

    // Check that fetchData was called with default sort options
    const callArgs = mockFetchData.mock.calls[0][0];
    expect(callArgs.sortOptions).toEqual({
      key: 'name',
      direction: 'ascending',
    });
  });

  it('updates sort options when column header is clicked', async () => {
    mockFetchData.mockClear();
    render(() => <TableView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resource A')).toBeInTheDocument();
    });

    mockFetchData.mockClear();

    // Click on the "Created" column header to sort
    const createdHeader = screen.getByText('Created');
    fireEvent.click(createdHeader);

    // Wait for fetchData to be called with new sort options
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalled();
    });

    const callArgs = mockFetchData.mock.calls[0][0];
    expect(callArgs.sortOptions).toEqual({
      key: 'created',
      direction: 'ascending',
    });
  });

  it('toggles sort direction when same column is clicked twice', async () => {
    mockFetchData.mockClear();
    render(() => <TableView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resource A')).toBeInTheDocument();
    });

    const nameHeader = screen.getByText('Name');

    // First click - should sort ascending (already default, but click triggers update)
    mockFetchData.mockClear();
    fireEvent.click(nameHeader);

    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalled();
    });

    let callArgs = mockFetchData.mock.calls[0][0];
    expect(callArgs.sortOptions.direction).toBe('ascending');

    // Second click - should toggle to descending
    mockFetchData.mockClear();
    fireEvent.click(nameHeader);

    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalled();
    });

    callArgs = mockFetchData.mock.calls[0][0];
    expect(callArgs.sortOptions).toEqual({
      key: 'name',
      direction: 'descending',
    });
  });

  it('resets to page 1 when sort changes', async () => {
    mockFetchData.mockClear();
    render(() => <TableView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resource A')).toBeInTheDocument();
    });

    mockFetchData.mockClear();

    // Click on a different column header
    const createdHeader = screen.getByText('Created');
    fireEvent.click(createdHeader);

    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalled();
    });

    // Verify that page is reset to 1
    const callArgs = mockFetchData.mock.calls[0][0];
    expect(callArgs.page.num).toBe(1);
  });

  it('does not sort when clicking non-sortable column', async () => {
    mockFetchData.mockClear();
    render(() => <TableView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resource A')).toBeInTheDocument();
    });

    const initialCallCount = mockFetchData.mock.calls.length;
    mockFetchData.mockClear();

    // Click on the "Type" column header (non-sortable)
    const typeHeader = screen.getByText('Type');
    fireEvent.click(typeHeader);

    // Wait a bit to ensure no additional calls are made
    await new Promise((resolve) => setTimeout(resolve, 100));

    // fetchData should not be called again
    expect(mockFetchData).not.toHaveBeenCalled();
  });
});

describe('TableView Component - Tag Filter Notification', () => {
  afterEach(() => cleanup());

  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'type', title: 'Type', sortable: false },
  ];

  const mockData = [
    { id: '1', name: 'Resource 1', type: 'Image' },
    { id: '2', name: 'Resource 2', type: 'Video' },
  ];

  const mockFetchData = vi.fn().mockResolvedValue({
    data: mockData,
    count: 2,
  });

  const defaultProps = {
    title: 'Test Resources',
    resource: 'resources',
    fetchData: mockFetchData,
    table: {
      columns,
    },
    pagination: {
      itemsPerPage: 10,
    },
  };

  it('does not show notification when tagFilterNotification is not provided', async () => {
    render(() => <TableView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Notification should not be present
    expect(screen.queryByText(/items are hidden/i)).not.toBeInTheDocument();
  });

  it('does not show notification when tagFilterNotification.isActive is false', async () => {
    const propsWithInactiveFilter = {
      ...defaultProps,
      tagFilterNotification: {
        isActive: false,
        message: 'Some items are hidden',
        onClear: vi.fn(),
      },
    };

    render(() => <TableView {...propsWithInactiveFilter} />);

    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Notification should not be present
    expect(screen.queryByText(/items are hidden/i)).not.toBeInTheDocument();
  });

  it('shows notification when tagFilterNotification.isActive is true', async () => {
    const mockClear = vi.fn();
    const propsWithActiveFilter = {
      ...defaultProps,
      tagFilterNotification: {
        isActive: true,
        message: 'Some items are hidden due to tag filtering',
        onClear: mockClear,
      },
    };

    render(() => <TableView {...propsWithActiveFilter} />);

    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Notification should be present
    expect(
      screen.getByText('Some items are hidden due to tag filtering')
    ).toBeInTheDocument();
  });

  it('calls onClear when clear button is clicked', async () => {
    const mockClear = vi.fn();
    const propsWithActiveFilter = {
      ...defaultProps,
      tagFilterNotification: {
        isActive: true,
        message: 'Some items are hidden due to tag filtering',
        onClear: mockClear,
      },
    };

    render(() => <TableView {...propsWithActiveFilter} />);

    await waitFor(() => {
      expect(screen.getByText('Resource 1')).toBeInTheDocument();
    });

    // Find and click the clear button (×)
    const clearButton = screen.getByText('×');
    fireEvent.click(clearButton);

    // Verify onClear was called
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
