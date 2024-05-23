/** @jsxImportSource solid-js */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { ToolBar } from './ToolBar';
import { FaSolidMagnifyingGlass } from 'solid-icons/fa';

// Mock Button component for mainAction
function MockButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button data-testid="main-action" onClick={onClick}>
      {label}
    </button>
  );
}

const initialFilters = [
  { key: 'active', name: 'Active', isActive: true },
  { key: 'inactive', name: 'Inactive', isActive: false },
];

describe('ToolBar Component', () => {
  afterEach(() => cleanup());

  it('renders title correctly', () => {
    render(() => <ToolBar title="Test Toolbar" />);
    expect(screen.getByText('Test Toolbar')).toBeInTheDocument();
  });

  it('renders the search input correctly', () => {
    render(() => <ToolBar />);
    const searchInputs = screen.getAllByPlaceholderText('Search...');
    expect(searchInputs.length).toBe(1);
  });

  it('triggers the onSearch callback with search text', async () => {
    const mockSearch = vi.fn();
    render(() => <ToolBar onSearch={mockSearch} />);
    const searchInput = screen.getByPlaceholderText('Search...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
    fireEvent.input(searchInput, { target: { value: 'Test Search' } });
    expect(searchInput).toHaveValue('Test Search');
    // We have a 300ms debounce on the search input, so we need to wait for it to trigger
    expect(mockSearch).not.toHaveBeenCalled();

    // wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mockSearch).toHaveBeenCalled();
    expect(mockSearch).toHaveBeenCalledWith('Test Search');
  });

  it.skip('renders filter switches and toggles them correctly', () => {
    const filters = [
      { key: 'active', name: 'Active', isActive: true },
      { key: 'inactive', name: 'Inactive', isActive: false },
    ];

    render(() => <ToolBar filters={filters} />);

    filters.forEach((filter) => {
      const label = screen.getByText(filter.name).closest('label');
      const switchInput = label?.querySelector('input');
      if (switchInput) {
        expect(switchInput).toBeInTheDocument();
        expect(switchInput).not.toBeChecked();

        fireEvent.click(switchInput, { target: { checked: true } });
        expect(switchInput).toBeChecked();
      }
    });
  });

  it('renders action buttons and triggers them correctly', () => {
    const mockAction = vi.fn();
    render(() => (
      <ToolBar actions={<button onClick={mockAction}>Remove</button>} />
    ));

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);
    expect(mockAction).toHaveBeenCalled();
  });

  it('renders and triggers the main action button', () => {
    const mockMainAction = vi.fn();
    render(() => (
      <ToolBar
        mainAction={<MockButton label="Add Device" onClick={mockMainAction} />}
      />
    ));
    const mainActionButton = screen.getByTestId('main-action');
    fireEvent.click(mainActionButton);
    expect(mockMainAction).toHaveBeenCalled();
  });
});

let mockOnFilterChange: any;
describe('ToolBar Filter Functionality', () => {
  beforeEach(() => {
    mockOnFilterChange = vi.fn();
    render(() => (
      <ToolBar filters={initialFilters} onFilterChange={mockOnFilterChange} />
    ));
  });

  afterEach(() => cleanup());

  it('renders all filters correctly', () => {
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders filter switches and toggles them correctly', async () => {
    const activeFilterCheckbox = screen.getByLabelText('Active', {
      selector: 'input',
    });
    expect(activeFilterCheckbox).toBeChecked();
    await fireEvent.click(activeFilterCheckbox);
    expect(activeFilterCheckbox).not.toBeChecked();

    const inactiveFilterCheckbox = screen.getByLabelText('Inactive', {
      selector: 'input',
    });
    expect(inactiveFilterCheckbox).not.toBeChecked();
    await fireEvent.click(inactiveFilterCheckbox);
    expect(inactiveFilterCheckbox).toBeChecked();
  });

  it('should toggle filter state when clicked', async () => {
    const inactiveFilterCheckbox = screen.getByLabelText('Inactive');
    expect(inactiveFilterCheckbox).not.toBeChecked();
    await fireEvent.click(inactiveFilterCheckbox);
    expect(inactiveFilterCheckbox).toBeChecked();
  });

  it('should not allow all filters to be disabled', async () => {
    const activeFilterCheckbox = screen.getByLabelText('Active');
    expect(activeFilterCheckbox).toBeChecked();
    await fireEvent.click(activeFilterCheckbox); // Attempt to disable the only active filter

    expect(mockOnFilterChange).not.toHaveBeenCalled();
  });
});

describe('ToolBar Filter Change Functionality', () => {
  afterEach(() => cleanup());

  it('should call onFilterChange callback when a filter is toggled', async () => {
    const mockOnFilterChange = vi.fn();
    render(() => (
      <ToolBar filters={initialFilters} onFilterChange={mockOnFilterChange} />
    ));

    const inactiveFilterCheckbox = screen.getByLabelText('Inactive');
    await fireEvent.click(inactiveFilterCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalled();
    expect(mockOnFilterChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        { key: 'active', name: 'Active', isActive: true },
        { key: 'inactive', name: 'Inactive', isActive: true }, // Check that the state has changed
      ])
    );
  });
});
