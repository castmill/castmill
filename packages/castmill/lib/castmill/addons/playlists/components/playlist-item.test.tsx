/**
 * Tests for PlaylistItem component
 * Testing icon URL resolution and thumbnail rendering
 *
 * Note: Since CSS modules hash class names, we use element selectors (img, span)
 * and src attribute queries instead of direct class name selectors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { PlaylistItem } from './playlist-item';
import type { JsonPlaylistItem } from '@castmill/player';
import { createSignal } from 'solid-js';

// Mock the draggable and dropTarget functions
vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: vi.fn(() => () => {}),
  dropTargetForElements: vi.fn(() => () => {}),
}));

// Fixtures only define the fields PlaylistItem reads, so overrides are loose.
type MockItemOverrides = Omit<
  Partial<JsonPlaylistItem>,
  'config' | 'widget'
> & {
  config?: { options: Record<string, unknown> };
  widget?: Record<string, unknown>;
};

// Base mock item structure
const createMockItem = (overrides: MockItemOverrides = {}): JsonPlaylistItem =>
  ({
    id: 1,
    duration: 10000,
    offset: 0,
    config: {
      options: {},
    },
    widget: {
      id: 1,
      name: 'Test Widget',
      slug: 'test-widget',
      description: 'A test widget',
      icon: undefined,
      template: {},
      options_schema: {},
      default_config: {},
      ...overrides.widget,
    },
    ...overrides,
  }) as unknown as JsonPlaylistItem;

describe('PlaylistItem Icon URL Resolution', () => {
  const baseUrl = 'http://localhost:4000';
  const defaultProps = {
    index: 0,
    baseUrl,
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onChangeDuration: vi.fn(),
    onDragStart: vi.fn(),
    animate: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders relative icon URL with baseUrl prefix', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'Weather Widget',
        slug: 'weather',
        icon: '/widgets/weather/icon.svg',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    const { container } = render(() => (
      <PlaylistItem item={item} {...defaultProps} />
    ));

    // Query by img element with expected src
    const iconImg = container.querySelector(
      'img[src="http://localhost:4000/widgets/weather/icon.svg"]'
    );
    expect(iconImg).toBeInTheDocument();
  });

  it('renders absolute URL icon without modification', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'External Widget',
        slug: 'external',
        icon: 'https://cdn.example.com/icon.svg',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    const { container } = render(() => (
      <PlaylistItem item={item} {...defaultProps} />
    ));

    const iconImg = container.querySelector(
      'img[src="https://cdn.example.com/icon.svg"]'
    );
    expect(iconImg).toBeInTheDocument();
  });

  it('renders data URI icon without modification', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'Inline Widget',
        slug: 'inline',
        icon: 'data:image/svg+xml,<svg></svg>',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    const { container } = render(() => (
      <PlaylistItem item={item} {...defaultProps} />
    ));

    // Data URI icons render as img elements
    const iconImg = container.querySelector('img[src^="data:image/"]');
    expect(iconImg).toBeInTheDocument();
    expect(iconImg).toHaveAttribute('src', 'data:image/svg+xml,<svg></svg>');
  });

  it('renders emoji icon as text symbol', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'Emoji Widget',
        slug: 'emoji',
        icon: '🎬',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    render(() => <PlaylistItem item={item} {...defaultProps} />);

    // Emoji icons should render as text, use getByText
    expect(screen.getByText('🎬')).toBeInTheDocument();
  });

  it('renders default icon when widget has no icon', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'No Icon Widget',
        slug: 'no-icon',
        icon: undefined,
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    render(() => <PlaylistItem item={item} {...defaultProps} />);

    // Should render default icon symbol (📦)
    expect(screen.getByText('📦')).toBeInTheDocument();
  });

  it('shows thumbnail for image widget instead of icon', () => {
    const item = createMockItem({
      config: {
        options: {
          image: {
            files: {
              thumbnail: {
                uri: 'https://example.com/thumbnail.jpg',
              },
            },
          },
        },
      },
      widget: {
        id: 1,
        name: 'Image',
        slug: 'image',
        icon: '/widgets/image/icon.svg',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    const { container } = render(() => (
      <PlaylistItem item={item} {...defaultProps} />
    ));

    // Should show thumbnail
    const thumbnailImg = container.querySelector(
      'img[src="https://example.com/thumbnail.jpg"]'
    );
    expect(thumbnailImg).toBeInTheDocument();

    // Icon should not be visible when thumbnail is present
    const iconImg = container.querySelector(
      'img[src*="/widgets/image/icon.svg"]'
    );
    expect(iconImg).not.toBeInTheDocument();
  });

  it('shows thumbnail for video widget instead of icon', () => {
    const item = createMockItem({
      config: {
        options: {
          video: {
            files: {
              thumbnail: {
                uri: 'https://example.com/video-thumb.jpg',
              },
            },
          },
        },
      },
      widget: {
        id: 1,
        name: 'Video',
        slug: 'video',
        icon: '/widgets/video/icon.svg',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    const { container } = render(() => (
      <PlaylistItem item={item} {...defaultProps} />
    ));

    // Should show thumbnail
    const thumbnailImg = container.querySelector(
      'img[src="https://example.com/video-thumb.jpg"]'
    );
    expect(thumbnailImg).toBeInTheDocument();
  });

  it('shows widget icon when no thumbnail available', () => {
    const item = createMockItem({
      config: {
        options: {},
      },
      widget: {
        id: 1,
        name: 'Weather',
        slug: 'weather',
        icon: '/widgets/weather/icon.svg',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    const { container } = render(() => (
      <PlaylistItem item={item} {...defaultProps} />
    ));

    // Should show icon when no thumbnail
    const iconImg = container.querySelector(
      'img[src="http://localhost:4000/widgets/weather/icon.svg"]'
    );
    expect(iconImg).toBeInTheDocument();
  });
});

describe('PlaylistItem Widget Info', () => {
  const defaultProps = {
    index: 0,
    baseUrl: 'http://localhost:4000',
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onChangeDuration: vi.fn(),
    onDragStart: vi.fn(),
    animate: false,
  };

  it('displays widget name', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'My Custom Widget',
        slug: 'custom',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    render(() => <PlaylistItem item={item} {...defaultProps} />);

    expect(screen.getByText('My Custom Widget')).toBeInTheDocument();
  });

  it('displays subtitle from widget options', () => {
    const item = createMockItem({
      config: {
        options: {
          title: 'Welcome Message',
        },
      },
      widget: {
        id: 1,
        name: 'Intro Widget',
        slug: 'intro',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    render(() => <PlaylistItem item={item} {...defaultProps} />);

    expect(screen.getByText('Welcome Message')).toBeInTheDocument();
  });
});

describe('PlaylistItem Dynamic Duration Display', () => {
  const defaultProps = {
    index: 0,
    baseUrl: 'http://localhost:4000',
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onChangeDuration: vi.fn(),
    onDragStart: vi.fn(),
    animate: false,
  };

  it('prefers computed dynamic duration when item duration is zero', () => {
    const item = createMockItem({
      duration: 0,
      widget: {
        id: 1,
        name: 'Video Widget',
        slug: 'video-widget',
        template: { type: 'video' },
        options_schema: {},
        default_config: {},
      },
    });

    render(() => (
      <PlaylistItem item={item} {...defaultProps} dynamicDuration={45000} />
    ));

    expect(screen.getByText('0:45')).toBeInTheDocument();
  });
});

describe('PlaylistItem Click Behavior', () => {
  const baseUrl = 'http://localhost:4000';
  const defaultProps = {
    index: 0,
    baseUrl,
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onChangeDuration: vi.fn(),
    onDragStart: vi.fn(),
    animate: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onClick when thumbnail area is clicked', async () => {
    const onClickMock = vi.fn();
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'Test Widget',
        slug: 'test',
        icon: '/widgets/test/icon.svg',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    render(() => (
      <PlaylistItem item={item} {...defaultProps} onClick={onClickMock} />
    ));

    // Click on the widget name (which is in the thumbnail area)
    const widgetName = screen.getByText('Test Widget');
    widgetName.click();

    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when onClick prop is not provided', () => {
    const item = createMockItem({
      widget: {
        id: 1,
        name: 'Test Widget',
        slug: 'test',
        template: {},
        options_schema: {},
        default_config: {},
      },
    });

    // Should not throw when onClick is not provided
    render(() => <PlaylistItem item={item} {...defaultProps} />);

    const widgetName = screen.getByText('Test Widget');
    widgetName.click(); // Should not throw
  });
});

describe('PlaylistItem actions', () => {
  const props = () => ({
    index: 1,
    baseUrl: 'http://localhost:4000',
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onChangeDuration: vi.fn(),
    onDragStart: vi.fn(),
    animate: false,
  });

  it('hides move buttons unless reorder handlers are provided', () => {
    render(() => <PlaylistItem item={createMockItem()} {...props()} />);

    expect(
      screen.queryByRole('button', { name: 'playlists.editor.moveUp' })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'playlists.editor.editItem' })
    ).toBeInTheDocument();
  });

  it('moves, edits and removes the item from its action buttons', () => {
    const p = props();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const item = createMockItem();
    render(() => (
      <PlaylistItem
        item={item}
        {...p}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    ));

    fireEvent.click(
      screen.getByRole('button', { name: 'playlists.editor.moveUp' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'playlists.editor.moveDown' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'playlists.editor.editItem' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'playlists.editor.removeItem' })
    );

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(p.onEdit).toHaveBeenCalledTimes(1);
    expect(p.onRemove).toHaveBeenCalledWith(item);
  });

  it('disables moving past the start or end of the playlist', () => {
    render(() => (
      <PlaylistItem
        item={createMockItem()}
        {...props()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        isFirst
        isLast
      />
    ));

    expect(
      screen.getByRole('button', { name: 'playlists.editor.moveUp' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'playlists.editor.moveDown' })
    ).toBeDisabled();
  });

  it('shows a reorder stepper instead of the drag grip', () => {
    const { container } = render(() => (
      <PlaylistItem
        item={createMockItem()}
        {...props()}
        index={1}
        position={2}
        total={5}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />
    ));

    const stepper = screen.getByRole('group', {
      name: 'playlists.editor.itemPosition',
    });
    expect(stepper.querySelectorAll('button')).toHaveLength(2);
    expect(container.querySelector('[aria-hidden="true"] svg')).toBeNull();
  });

  it('disables dragging and hides the grip when drag is off', async () => {
    const { draggable } =
      await import('@atlaskit/pragmatic-drag-and-drop/element/adapter');
    const { container, unmount } = render(() => (
      <PlaylistItem item={createMockItem()} {...props()} />
    ));
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
    unmount();

    vi.mocked(draggable).mockClear();
    const touch = render(() => (
      <PlaylistItem item={createMockItem()} {...props()} dragEnabled={false} />
    ));

    expect(
      touch.container.querySelector('span[aria-hidden="true"]')
    ).toBeNull();
    const args = vi.mocked(draggable).mock.calls[0][0];
    expect(args.canDrag?.({} as any)).toBe(false);
  });

  it('keeps focus in the stepper when the item reaches an edge', () => {
    const [isFirst, setIsFirst] = createSignal(false);
    render(() => (
      <PlaylistItem
        item={createMockItem()}
        {...props()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        isFirst={isFirst()}
      />
    ));
    const up = screen.getByRole('button', { name: 'playlists.editor.moveUp' });
    up.focus();

    setIsFirst(true);

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'playlists.editor.moveDown' })
    );
  });

  it('scrolls into view when highlighted after a move', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const [highlighted, setHighlighted] = createSignal(false);
    render(() => (
      <PlaylistItem
        item={createMockItem()}
        {...props()}
        highlighted={highlighted()}
      />
    ));

    setHighlighted(true);

    expect(scroll).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth',
    });
  });
});
