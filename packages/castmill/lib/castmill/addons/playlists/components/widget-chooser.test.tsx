/**
 * Tests for WidgetChooser component
 * Testing the search functionality and widget rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { WidgetChooser } from './widget-chooser';
import type { JsonWidget } from '@castmill/player';

// Mock widgets data
const mockWidgets: JsonWidget[] = [
  {
    id: 1,
    name: 'Image Widget',
    description: 'Display an image',
    icon: '📦',
    options: {},
    default_config: {},
  },
  {
    id: 2,
    name: 'Video Widget',
    description: 'Display a video',
    icon: '📹',
    options: {},
    default_config: {},
  },
  {
    id: 3,
    name: 'Weather Widget',
    description: 'Display weather information',
    icon: '🌤️',
    options: {},
    default_config: {},
  },
];

describe('WidgetChooser Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all widgets correctly', () => {
    render(() => <WidgetChooser widgets={mockWidgets} />);

    // Check if all widgets are rendered
    expect(screen.getByText('Image Widget')).toBeInTheDocument();
    expect(screen.getByText('Display an image')).toBeInTheDocument();
    expect(screen.getByText('Video Widget')).toBeInTheDocument();
    expect(screen.getByText('Display a video')).toBeInTheDocument();
    expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    expect(screen.getByText('Display weather information')).toBeInTheDocument();
  });

  it('renders search input with correct placeholder', () => {
    render(() => <WidgetChooser widgets={mockWidgets} />);

    const searchInput = screen.getByPlaceholderText('Search widgets...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
  });

  it.skip('renders search icon', () => {
    const { container } = render(() => <WidgetChooser widgets={mockWidgets} />);

    // Check if search container exists
    const searchContainer = container.querySelector('.search-container');
    expect(searchContainer).toBeInTheDocument();

    // Check if SVG icon is present
    const icon = searchContainer?.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('calls onSearch callback with debounce when typing', async () => {
    vi.useFakeTimers();
    const onSearchMock = vi.fn();

    render(() => (
      <WidgetChooser widgets={mockWidgets} onSearch={onSearchMock} />
    ));

    const searchInput = screen.getByPlaceholderText('Search widgets...');

    // Type in the search input
    fireEvent.input(searchInput, { target: { value: 'video' } });

    // Should not call immediately
    expect(onSearchMock).not.toHaveBeenCalled();

    // Fast-forward time by 300ms (debounce period)
    vi.advanceTimersByTime(300);

    // Now it should have been called
    expect(onSearchMock).toHaveBeenCalledWith('video');
    expect(onSearchMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it.skip('debounces multiple rapid inputs correctly', async () => {
    vi.useFakeTimers();
    const onSearchMock = vi.fn();

    render(() => (
      <WidgetChooser widgets={mockWidgets} onSearch={onSearchMock} />
    ));

    const searchInput = screen.getByPlaceholderText('Search widgets...');

    // Rapid typing
    fireEvent.input(searchInput, { target: { value: 'v' } });
    vi.advanceTimersByTime(100);
    fireEvent.input(searchInput, { target: { value: 'vi' } });
    vi.advanceTimersByTime(100);
    fireEvent.input(searchInput, { target: { value: 'vid' } });
    vi.advanceTimersByTime(100);

    // Should not have called yet
    expect(onSearchMock).not.toHaveBeenCalled();

    // Fast-forward remaining time (debounce is 300ms, we've only advanced 100ms since last input)
    vi.advanceTimersByTime(200);

    // Should be called once with the last value
    expect(onSearchMock).toHaveBeenCalledWith('vid');
    expect(onSearchMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('updates search input value when user types', () => {
    render(() => <WidgetChooser widgets={mockWidgets} />);

    const searchInput = screen.getByPlaceholderText(
      'Search widgets...'
    ) as HTMLInputElement;

    fireEvent.input(searchInput, { target: { value: 'weather' } });

    expect(searchInput.value).toBe('weather');
  });

  it('renders empty list when no widgets provided', () => {
    const { container } = render(() => <WidgetChooser widgets={[]} />);

    const itemsContainer = container.querySelector('.items-container');
    expect(itemsContainer).toBeInTheDocument();
    expect(itemsContainer?.children.length).toBe(0);
  });

  it('works without onSearch callback', () => {
    render(() => <WidgetChooser widgets={mockWidgets} />);

    const searchInput = screen.getByPlaceholderText('Search widgets...');

    // Should not throw error when typing without onSearch callback
    expect(() => {
      fireEvent.input(searchInput, { target: { value: 'test' } });
    }).not.toThrow();
  });

  it('clears debounce timeout on unmount', () => {
    vi.useFakeTimers();
    const onSearchMock = vi.fn();

    const { unmount } = render(() => (
      <WidgetChooser widgets={mockWidgets} onSearch={onSearchMock} />
    ));

    const searchInput = screen.getByPlaceholderText('Search widgets...');

    fireEvent.input(searchInput, { target: { value: 'test' } });

    // Unmount before debounce completes
    unmount();

    // Fast-forward time
    vi.advanceTimersByTime(300);

    // Should not have been called because component was unmounted
    expect(onSearchMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('renders widget items with correct structure', () => {
    const { container } = render(() => <WidgetChooser widgets={mockWidgets} />);

    const widgetItems = container.querySelectorAll('.widget-item');
    expect(widgetItems.length).toBe(mockWidgets.length);

    // Check first widget item structure
    const firstItem = widgetItems[0];
    expect(firstItem.querySelector('.widget-icon')).toBeInTheDocument();
    expect(firstItem.querySelector('.info')).toBeInTheDocument();
    expect(firstItem.querySelector('.name')).toBeInTheDocument();
    expect(firstItem.querySelector('.description')).toBeInTheDocument();
  });
});
