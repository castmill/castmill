/**
 * Tests for WidgetChooser component
 * Testing the search functionality, widget rendering, and icon URL resolution
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { WidgetChooser } from './widget-chooser';
import type { JsonWidget, JsonWidgetTemplate } from '@castmill/player';
import { createSignal } from 'solid-js';

const mockDraggable = vi.hoisted(() =>
  vi.fn((_options: { element: HTMLElement }) => () => {})
);

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: mockDraggable,
}));

const mockTemplate = {
  type: 'image',
  name: 'image',
  opts: {},
} as JsonWidgetTemplate;

// Mock widgets data
const mockWidgets: JsonWidget[] = [
  {
    id: 1,
    name: 'Image Widget',
    description: 'Display an image',
    icon: '📦',
    template: mockTemplate,
  },
  {
    id: 2,
    name: 'Video Widget',
    description: 'Display a video',
    icon: '📹',
    template: mockTemplate,
  },
  {
    id: 3,
    name: 'Weather Widget',
    description: 'Display weather information',
    icon: '🌤️',
    template: mockTemplate,
  },
];

// Mock widgets with various icon types for icon URL testing
const mockWidgetsWithIcons: JsonWidget[] = [
  {
    id: 1,
    name: 'Widget with relative icon',
    description: 'Icon starts with /',
    icon: '/widgets/test/icon.svg',
    template: mockTemplate,
  },
  {
    id: 2,
    name: 'Widget with absolute URL icon',
    description: 'Icon is absolute URL',
    icon: 'https://example.com/icon.svg',
    template: mockTemplate,
  },
  {
    id: 3,
    name: 'Widget with data URI icon',
    description: 'Icon is data URI',
    icon: 'data:image/svg+xml,<svg></svg>',
    template: mockTemplate,
  },
  {
    id: 4,
    name: 'Widget with emoji icon',
    description: 'Icon is emoji',
    icon: '📦',
    template: mockTemplate,
  },
  {
    id: 5,
    name: 'Widget without icon',
    description: 'No icon specified',
    template: mockTemplate,
  },
];

describe('WidgetChooser Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all widgets correctly', () => {
    render(() => <WidgetChooser baseUrl="" widgets={mockWidgets} />);

    // Check if all widgets are rendered
    expect(screen.getByText('Image Widget')).toBeInTheDocument();
    expect(screen.getByText('Display an image')).toBeInTheDocument();
    expect(screen.getByText('Video Widget')).toBeInTheDocument();
    expect(screen.getByText('Display a video')).toBeInTheDocument();
    expect(screen.getByText('Weather Widget')).toBeInTheDocument();
    expect(screen.getByText('Display weather information')).toBeInTheDocument();
  });

  it('registers draggable elements after their refs are assigned', () => {
    render(() => <WidgetChooser baseUrl="" widgets={mockWidgets} />);

    expect(mockDraggable).toHaveBeenCalledTimes(mockWidgets.length);
    for (const [options] of mockDraggable.mock.calls) {
      expect(options.element).toBeInstanceOf(HTMLElement);
    }
  });

  it('renders search input with correct placeholder', () => {
    render(() => <WidgetChooser baseUrl="" widgets={mockWidgets} />);

    const searchInput = screen.getByPlaceholderText('Search widgets...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue('');
  });

  it.skip('renders search icon', () => {
    const { container } = render(() => (
      <WidgetChooser baseUrl="" widgets={mockWidgets} />
    ));

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
      <WidgetChooser baseUrl="" widgets={mockWidgets} onSearch={onSearchMock} />
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
      <WidgetChooser baseUrl="" widgets={mockWidgets} onSearch={onSearchMock} />
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
    render(() => <WidgetChooser baseUrl="" widgets={mockWidgets} />);

    const searchInput = screen.getByPlaceholderText(
      'Search widgets...'
    ) as HTMLInputElement;

    fireEvent.input(searchInput, { target: { value: 'weather' } });

    expect(searchInput.value).toBe('weather');
  });

  it('renders empty list when no widgets provided', () => {
    const { container } = render(() => (
      <WidgetChooser baseUrl="" widgets={[]} />
    ));

    const itemsContainer = container.querySelector('.items-container');
    expect(itemsContainer).toBeInTheDocument();
    expect(itemsContainer?.children.length).toBe(0);
  });

  it('works without onSearch callback', () => {
    render(() => <WidgetChooser baseUrl="" widgets={mockWidgets} />);

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
      <WidgetChooser baseUrl="" widgets={mockWidgets} onSearch={onSearchMock} />
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
    const { container } = render(() => (
      <WidgetChooser baseUrl="" widgets={mockWidgets} />
    ));

    const widgetItems = container.querySelectorAll('.widget-item');
    expect(widgetItems.length).toBe(mockWidgets.length);

    // Check first widget item structure
    const firstItem = widgetItems[0];
    expect(firstItem.querySelector('.widget-icon')).toBeInTheDocument();
    expect(firstItem.querySelector('.info')).toBeInTheDocument();
    expect(firstItem.querySelector('.name')).toBeInTheDocument();
    expect(firstItem.querySelector('.description')).toBeInTheDocument();
  });

  it('shows the full widget description as a hover tooltip', () => {
    const { container } = render(() => (
      <WidgetChooser baseUrl="" widgets={mockWidgets} />
    ));

    const firstItem = container.querySelector('.widget-item')!;
    expect(firstItem.getAttribute('title')).toBe('Display an image');
  });
});

describe('WidgetChooser adding widgets', () => {
  const t = (key: string, params?: Record<string, any>) =>
    params?.name ? `${key}:${params.name}` : key;

  it('adds a widget with the + button without the row handling the click', () => {
    const onAdd = vi.fn();
    render(() => (
      <WidgetChooser baseUrl="" widgets={mockWidgets} t={t} onAdd={onAdd} />
    ));

    fireEvent.click(
      screen.getByRole('button', {
        name: 'playlists.editor.addWidgetNamed:Video Widget',
      })
    );

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(mockWidgets[1]);
  });

  it('only adds on row click in tap-to-add mode', () => {
    const onAdd = vi.fn();
    const [tapToAdd, setTapToAdd] = createSignal(false);
    render(() => (
      <WidgetChooser
        baseUrl=""
        widgets={mockWidgets}
        t={t}
        onAdd={onAdd}
        tapToAdd={tapToAdd()}
      />
    ));

    fireEvent.click(screen.getByText('Image Widget'));
    expect(onAdd).not.toHaveBeenCalled();

    setTapToAdd(true);
    fireEvent.click(screen.getByText('Image Widget'));
    expect(onAdd).toHaveBeenCalledWith(mockWidgets[0]);
  });

  it('renders the picker header with a back button', () => {
    const onClose = vi.fn();
    render(() => (
      <WidgetChooser
        baseUrl=""
        widgets={mockWidgets}
        t={t}
        title="Choose a widget"
        hint="Tap a widget"
        onClose={onClose}
      />
    ));

    expect(
      screen.getByRole('heading', { name: 'Choose a widget' })
    ).toBeInTheDocument();
    expect(screen.getByText('Tap a widget')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.back' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('WidgetChooser Icon URL Resolution', () => {
  const baseUrl = 'http://localhost:4000';

  it('renders relative icon URL with baseUrl prefix', () => {
    const widgetWithRelativeIcon = [mockWidgetsWithIcons[0]]; // /widgets/test/icon.svg
    const { container } = render(() => (
      <WidgetChooser widgets={widgetWithRelativeIcon} baseUrl={baseUrl} />
    ));

    const iconImg = container.querySelector('.widget-icon img');
    expect(iconImg).toBeInTheDocument();
    expect(iconImg).toHaveAttribute(
      'src',
      'http://localhost:4000/widgets/test/icon.svg'
    );
  });

  it('renders absolute URL icon without modification', () => {
    const widgetWithAbsoluteIcon = [mockWidgetsWithIcons[1]]; // https://example.com/icon.svg
    const { container } = render(() => (
      <WidgetChooser widgets={widgetWithAbsoluteIcon} baseUrl={baseUrl} />
    ));

    const iconImg = container.querySelector('.widget-icon img');
    expect(iconImg).toBeInTheDocument();
    expect(iconImg).toHaveAttribute('src', 'https://example.com/icon.svg');
  });

  it('renders data URI icon without modification', () => {
    const widgetWithDataUri = [mockWidgetsWithIcons[2]]; // data:image/svg+xml,...
    const { container } = render(() => (
      <WidgetChooser widgets={widgetWithDataUri} baseUrl={baseUrl} />
    ));

    const iconImg = container.querySelector('.widget-icon img');
    expect(iconImg).toBeInTheDocument();
    expect(iconImg).toHaveAttribute('src', 'data:image/svg+xml,<svg></svg>');
  });

  it('renders emoji icon as text symbol', () => {
    const widgetWithEmoji = [mockWidgetsWithIcons[3]]; // 📦
    const { container } = render(() => (
      <WidgetChooser widgets={widgetWithEmoji} baseUrl={baseUrl} />
    ));

    // Emoji icons should not render as img
    const iconImg = container.querySelector('.widget-icon img');
    expect(iconImg).not.toBeInTheDocument();

    // Should render as text in a span
    const iconContainer = container.querySelector('.widget-icon span');
    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer?.textContent).toBe('📦');
  });

  it('renders default icon when widget has no icon', () => {
    const widgetWithoutIcon = [mockWidgetsWithIcons[4]]; // no icon
    const { container } = render(() => (
      <WidgetChooser widgets={widgetWithoutIcon} baseUrl={baseUrl} />
    ));

    // Should render default icon in a span (DEFAULT_WIDGET_ICON = '📦')
    const iconContainer = container.querySelector('.widget-icon span');
    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer?.textContent).toBe('📦');
  });

  it('handles empty baseUrl gracefully', () => {
    const widgetWithRelativeIcon = [mockWidgetsWithIcons[0]];
    const { container } = render(() => (
      <WidgetChooser widgets={widgetWithRelativeIcon} baseUrl="" />
    ));

    // Should still render the icon with just the relative path
    const iconImg = container.querySelector('.widget-icon img');
    expect(iconImg).toBeInTheDocument();
    expect(iconImg).toHaveAttribute('src', '/widgets/test/icon.svg');
  });
});
