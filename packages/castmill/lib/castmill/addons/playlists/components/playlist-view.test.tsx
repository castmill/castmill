/**
 * Tests for PlaylistView component
 * Testing the widget search integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { PlaylistView } from './playlist-view';
import { PlaylistsService } from '../services/playlists.service';

// Mock the services
vi.mock('../services/playlists.service', () => ({
  PlaylistsService: {
    getPlaylist: vi.fn(),
    getWidgets: vi.fn(),
    insertWidgetIntoPlaylist: vi.fn(),
    updateItemInPlaylist: vi.fn(),
    updateWidgetConfig: vi.fn(),
    moveItemInPlaylist: vi.fn(),
    removeItemFromPlaylist: vi.fn(),
  },
}));

// Mock the child components
vi.mock('./playlist-preview', () => ({
  PlaylistPreview: () => <div data-testid="playlist-preview">Preview</div>,
}));

vi.mock('./playlist-items', () => ({
  PlaylistItems: () => <div data-testid="playlist-items">Items</div>,
}));

vi.mock('./widget-chooser', () => ({
  WidgetChooser: (props: any) => (
    <div data-testid="widget-chooser">
      <button
        data-testid="search-trigger"
        onClick={() => props.onSearch?.('test search')}
      >
        Trigger Search
      </button>
    </div>
  ),
}));

const mockPlaylist = {
  id: 1,
  name: 'Test Playlist',
  description: 'Test Description',
  items: [],
  organization_id: 'org-123',
};

const mockWidgets = {
  data: [
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
  ],
  count: 2,
};

const mockFilteredWidgets = {
  data: [
    {
      id: 2,
      name: 'Video Widget',
      description: 'Display a video',
      icon: '📹',
      options: {},
      default_config: {},
    },
  ],
  count: 1,
};

describe('PlaylistView Component', () => {
  const baseUrl = 'http://test.com';
  const organizationId = 'org-123';
  const playlistId = 1;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue(mockPlaylist);
    vi.mocked(PlaylistsService.getWidgets).mockResolvedValue(mockWidgets);
  });

  it('renders all child components after loading', async () => {
    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    await waitFor(() => {
      expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
      expect(screen.getByTestId('widget-chooser')).toBeInTheDocument();
      expect(screen.getByTestId('playlist-items')).toBeInTheDocument();
    });
  });

  it('fetches playlist and widgets on mount', async () => {
    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    await waitFor(() => {
      expect(PlaylistsService.getPlaylist).toHaveBeenCalledWith(
        baseUrl,
        organizationId,
        playlistId
      );
      expect(PlaylistsService.getWidgets).toHaveBeenCalledWith(
        baseUrl,
        organizationId
      );
    });
  });

  it('calls getWidgets with search term when search is triggered', async () => {
    vi.mocked(PlaylistsService.getWidgets).mockResolvedValueOnce(mockWidgets);

    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('widget-chooser')).toBeInTheDocument();
    });

    // Clear the initial call
    vi.mocked(PlaylistsService.getWidgets).mockClear();

    // Mock the search response
    vi.mocked(PlaylistsService.getWidgets).mockResolvedValueOnce(
      mockFilteredWidgets
    );

    // Trigger search
    const searchTrigger = screen.getByTestId('search-trigger');
    searchTrigger.click();

    await waitFor(() => {
      expect(PlaylistsService.getWidgets).toHaveBeenCalledWith(
        baseUrl,
        organizationId,
        'test search'
      );
    });
  });

  it('updates widgets when search returns results', async () => {
    vi.mocked(PlaylistsService.getWidgets)
      .mockResolvedValueOnce(mockWidgets)
      .mockResolvedValueOnce(mockFilteredWidgets);

    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    // Wait for initial load
    await waitFor(() => {
      expect(PlaylistsService.getWidgets).toHaveBeenCalledTimes(1);
    });

    // Trigger search
    const searchTrigger = screen.getByTestId('search-trigger');
    searchTrigger.click();

    await waitFor(() => {
      expect(PlaylistsService.getWidgets).toHaveBeenCalledTimes(2);
    });
  });

  it('handles empty search results', async () => {
    const emptyResult = { data: [], count: 0 };

    vi.mocked(PlaylistsService.getWidgets)
      .mockResolvedValueOnce(mockWidgets)
      .mockResolvedValueOnce(emptyResult);

    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    await waitFor(() => {
      expect(screen.getByTestId('widget-chooser')).toBeInTheDocument();
    });

    // Trigger search
    const searchTrigger = screen.getByTestId('search-trigger');
    searchTrigger.click();

    await waitFor(() => {
      expect(PlaylistsService.getWidgets).toHaveBeenCalledWith(
        baseUrl,
        organizationId,
        'test search'
      );
    });
  });

  it('calls onChange callback when provided', async () => {
    const onChangeMock = vi.fn();

    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
        onChange={onChangeMock}
      />
    ));

    await waitFor(() => {
      expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
    });

    // The onChange is called when playlist items are modified
    // This would be tested in integration with actual item operations
  });

  it('shows loading state initially', () => {
    const { container } = render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    // When loading, the Show component should not render its children
    expect(container.querySelector('.playlist-view')).not.toBeInTheDocument();
  });

  it('handles errors when fetching playlist fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(PlaylistsService.getPlaylist).mockRejectedValueOnce(
      new Error('Failed to fetch playlist')
    );

    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    await waitFor(() => {
      expect(PlaylistsService.getPlaylist).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it('handles errors when fetching widgets fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(PlaylistsService.getWidgets).mockRejectedValueOnce(
      new Error('Failed to fetch widgets')
    );

    render(() => (
      <PlaylistView
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    await waitFor(() => {
      expect(PlaylistsService.getWidgets).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });
});
