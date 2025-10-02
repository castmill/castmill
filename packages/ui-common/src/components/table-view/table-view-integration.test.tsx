/** @jsxImportSource solid-js */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { TableView } from './table-view';

describe('TableView - Real-world Integration Demo', () => {
  it('demonstrates the feature working like in dashboard components', async () => {
    // This test mimics how the feature is used in dashboard components
    // like resources-view.tsx and resource-chooser.tsx

    const mockData = [
      {
        id: '1',
        name: 'Sample Resource 1',
        type: 'Image',
        files: { thumbnail: { uri: '/thumb1.jpg' } },
      },
      {
        id: '2',
        name: 'Sample Resource 2',
        type: 'Video',
        files: { thumbnail: { uri: '/thumb2.jpg' } },
      },
      {
        id: '3',
        name: 'Sample Resource 3',
        type: 'Document',
        files: { thumbnail: { uri: '/thumb3.jpg' } },
      },
    ];

    const mockFetchData = vi.fn().mockResolvedValue({
      data: mockData,
      count: 3,
    });

    // Mock handlers that mimic real dashboard functionality
    const openViewModal = vi.fn();
    const deleteResource = vi.fn();
    const onRowSelect = vi.fn();

    // Configuration that matches real dashboard usage
    const columns = [
      {
        key: 'name',
        title: 'Name',
        sortable: true,
      },
      {
        key: 'type',
        title: 'Type',
        sortable: true,
      },
    ];

    const actions = [
      {
        icon: BsEye,
        handler: openViewModal,
        label: 'View',
      },
      {
        icon: AiOutlineDelete,
        handler: deleteResource,
        label: 'Delete',
      },
    ];

    render(() => (
      <TableView
        title="Resources"
        resource="resources"
        fetchData={mockFetchData}
        table={{
          columns,
          actions,
          onRowSelect,
          // The key feature: defaultRowAction that uses the same handler as the View action
          defaultRowAction: {
            icon: BsEye,
            handler: openViewModal,
            label: 'View',
          },
        }}
        pagination={{ itemsPerPage: 10 }}
      />
    ));

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Sample Resource 1')).toBeInTheDocument();
    });

    // Clear any setup calls
    openViewModal.mockClear();
    deleteResource.mockClear();
    onRowSelect.mockClear();

    // Test 1: Row click should trigger the View action (most common user flow)
    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1]; // Skip header row
    fireEvent.click(firstDataRow);

    expect(openViewModal).toHaveBeenCalledWith(mockData[0]);
    expect(openViewModal).toHaveBeenCalledTimes(1);
    expect(deleteResource).not.toHaveBeenCalled();

    openViewModal.mockClear();

    // Test 2: View button should trigger the same action
    const viewButton = screen.getByLabelText('View Sample Resource 1');
    fireEvent.click(viewButton);

    expect(openViewModal).toHaveBeenCalledWith(mockData[0]);
    expect(openViewModal).toHaveBeenCalledTimes(1);
    expect(deleteResource).not.toHaveBeenCalled();

    openViewModal.mockClear();

    // Test 3: Delete button should work independently
    const deleteButton = screen.getByLabelText('Delete Sample Resource 1');
    fireEvent.click(deleteButton);

    expect(deleteResource).toHaveBeenCalledWith(mockData[0]);
    expect(deleteResource).toHaveBeenCalledTimes(1);
    expect(openViewModal).not.toHaveBeenCalled();

    deleteResource.mockClear();

    // Test 4: Checkbox should work independently
    const checkbox = screen.getAllByRole('checkbox')[1]; // First data row checkbox
    fireEvent.click(checkbox);

    expect(onRowSelect).toHaveBeenCalled();
    expect(openViewModal).not.toHaveBeenCalled();
    expect(deleteResource).not.toHaveBeenCalled();

    // Test 5: Verify multiple items can be interacted with
    const secondDataRow = rows[2];
    fireEvent.click(secondDataRow);

    expect(openViewModal).toHaveBeenCalledWith(mockData[1]);
    expect(openViewModal).toHaveBeenCalledTimes(1);
  });

  it('verifies row clickability and cursor styling', async () => {
    const mockFetchData = vi.fn().mockResolvedValue({
      data: [{ id: '1', name: 'Test Resource', type: 'Image' }],
      count: 1,
    });

    const mockHandler = vi.fn();

    render(() => (
      <TableView
        title="Test With Action"
        resource="test"
        fetchData={mockFetchData}
        table={{
          columns: [{ key: 'name', title: 'Name' }],
          defaultRowAction: {
            icon: BsEye,
            handler: mockHandler,
            label: 'View',
          },
        }}
        pagination={{ itemsPerPage: 10 }}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('Test Resource')).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    const dataRow = rows[1];

    // Should have pointer cursor indicating it's clickable
    expect(dataRow).toHaveStyle('cursor: pointer');

    // This demonstrates that the feature correctly configures cursor styling
    // based on the presence of the defaultRowAction, which is the key UX improvement
  });
});
