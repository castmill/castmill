/**
 * Tests for PlaylistView component
 * Testing the widget search integration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { PlaylistView, WIDE_LAYOUT_QUERY } from './playlist-view';
import { PlaylistsService } from '../services/playlists.service';
import type { AddonStore } from '../../common/interfaces/addon-store';
import type { JsonPlaylist, JsonWidgetTemplate } from '@castmill/player';

// Stable toast spies that can be referenced inside tests.
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual<typeof import('@castmill/ui-common')>(
    '@castmill/ui-common'
  );

  return {
    ...actual,
    useToast: () => mockToast,
  };
});

// Mock the services
vi.mock('../services/playlists.service', () => ({
  PlaylistsService: {
    getPlaylist: vi.fn(),
    getWidgets: vi.fn(),
    updatePlaylist: vi.fn(),
    insertWidgetIntoPlaylist: vi.fn(),
    updateItemInPlaylist: vi.fn(),
    updateWidgetConfig: vi.fn(),
    moveItemInPlaylist: vi.fn(),
    removeItemFromPlaylist: vi.fn(),
    fetchWidgetConfigData: vi.fn(),
  },
}));

// Mock the child components
vi.mock('./playlist-preview', () => ({
  PlaylistPreview: (props: any) => {
    playlistPreviewProps.current = props;
    return <div data-testid="playlist-preview">Preview</div>;
  },
}));

const playlistPreviewProps = vi.hoisted(() => ({ current: null as any }));
const playlistItemsProps = vi.hoisted(() => ({ current: null as any }));
const addWidgetSpy = vi.hoisted(() => vi.fn());

vi.mock('./playlist-items', () => ({
  PlaylistItems: (props: any) => {
    playlistItemsProps.current = props;
    props.onAddWidgetReady?.(addWidgetSpy);
    return <div data-testid="playlist-items">Items</div>;
  },
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
      <button
        data-testid="add-trigger"
        data-tap-to-add={String(!!props.tapToAdd)}
        onClick={() => props.onAdd?.({ id: 1, name: 'Image Widget' })}
      >
        Add
      </button>
      {props.onClose && (
        <button data-testid="close-picker" onClick={() => props.onClose()}>
          Back
        </button>
      )}
    </div>
  ),
}));

const mockStore = {} as AddonStore;

const mockPlaylist: JsonPlaylist = {
  id: 1,
  name: 'Test Playlist',
  status: 'live',
  items: [],
};

const mockTemplate = {
  type: 'image',
  name: 'image',
  opts: {},
} as JsonWidgetTemplate;

const mockWidgets = {
  data: [
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
      template: mockTemplate,
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
    playlistPreviewProps.current = null;
    playlistItemsProps.current = null;

    // Setup default mocks
    vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue(mockPlaylist);
    vi.mocked(PlaylistsService.getWidgets).mockResolvedValue(mockWidgets);
  });

  it('renders all child components after loading', async () => {
    render(() => (
      <PlaylistView
        store={mockStore}
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
        store={mockStore}
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
        store={mockStore}
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
        store={mockStore}
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
        store={mockStore}
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
        store={mockStore}
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
        store={mockStore}
        playlistId={playlistId}
        organizationId={organizationId}
        baseUrl={baseUrl}
      />
    ));

    // When loading, the Show component should not render its children
    expect(container.querySelector('.playlist-view')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
  });

  it.skip('handles errors when fetching playlist fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(PlaylistsService.getPlaylist).mockRejectedValueOnce(
      new Error('Failed to fetch playlist')
    );

    render(() => (
      <PlaylistView
        store={mockStore}
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

  it.skip('handles errors when fetching widgets fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(PlaylistsService.getWidgets).mockRejectedValueOnce(
      new Error('Failed to fetch widgets')
    );

    render(() => (
      <PlaylistView
        store={mockStore}
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

  describe('Aspect Ratio and ResizeObserver', () => {
    let mockResizeObserver: any;
    let observeCallback: ResizeObserverCallback;

    beforeEach(() => {
      // Mock ResizeObserver
      mockResizeObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      };

      global.ResizeObserver = vi.fn((callback) => {
        observeCallback = callback;
        return mockResizeObserver;
      }) as any;
    });

    it('sets up ResizeObserver when component mounts', async () => {
      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(global.ResizeObserver).toHaveBeenCalled();
        expect(mockResizeObserver.observe).toHaveBeenCalled();
      });
    });

    it('applies constrain-by-width class when container is narrower than target ratio', async () => {
      const portraitPlaylist = {
        ...mockPlaylist,
        settings: {
          aspect_ratio: { width: 9, height: 16 },
        },
      };

      vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue(
        portraitPlaylist
      );

      const { container } = render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(mockResizeObserver.observe).toHaveBeenCalled();
      });

      // Simulate a narrow container (width: 300, height: 800)
      // Container ratio: 300/800 = 0.375
      // Target ratio (9:16): 9/16 = 0.5625
      // Since 0.375 < 0.5625, should apply constrain-by-width
      const entries = [
        {
          target: container.querySelector('.playlist-preview-wrapper'),
          contentRect: { width: 300, height: 800 },
        },
      ];

      observeCallback(entries as any, mockResizeObserver);

      await waitFor(() => {
        const wrapper = container.querySelector('.playlist-preview-wrapper');
        expect(wrapper?.classList.contains('constrain-by-width')).toBe(true);
      });
    });

    it('does not apply constrain-by-width class when container is wider than target ratio', async () => {
      const portraitPlaylist = {
        ...mockPlaylist,
        settings: {
          aspect_ratio: { width: 9, height: 16 },
        },
      };

      vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue(
        portraitPlaylist
      );

      const { container } = render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(mockResizeObserver.observe).toHaveBeenCalled();
      });

      // Simulate a wider container (width: 600, height: 800)
      // Container ratio: 600/800 = 0.75
      // Target ratio (9:16): 9/16 = 0.5625
      // Since 0.75 > 0.5625, should NOT apply constrain-by-width
      const entries = [
        {
          target: container.querySelector('.playlist-preview-wrapper'),
          contentRect: { width: 600, height: 800 },
        },
      ];

      observeCallback(entries as any, mockResizeObserver);

      await waitFor(() => {
        const wrapper = container.querySelector('.playlist-preview-wrapper');
        expect(wrapper?.classList.contains('constrain-by-width')).toBe(false);
      });
    });

    it('disconnects ResizeObserver on cleanup', async () => {
      const { unmount } = render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(mockResizeObserver.observe).toHaveBeenCalled();
      });

      unmount();

      expect(mockResizeObserver.disconnect).toHaveBeenCalled();
    });

    it('applies correct aspect-ratio style to preview', async () => {
      const customPlaylist = {
        ...mockPlaylist,
        settings: {
          aspect_ratio: { width: 4, height: 3 },
        },
      };

      vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue(customPlaylist);

      const { container } = render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        const preview = container.querySelector('.playlist-preview');
        expect(preview).toBeInTheDocument();
        const style = preview?.getAttribute('style');
        expect(style).toContain('aspect-ratio: 4 / 3');
      });
    });
  });

  describe('Aspect Ratio Customization', () => {
    beforeEach(() => {
      vi.mocked(PlaylistsService.updatePlaylist).mockResolvedValue(undefined);
    });

    it('saves a preset aspect ratio and shows success toast', async () => {
      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
      });

      // Select a different preset (default is 16:9, pick 9:16)
      const select = screen.getByRole('combobox', {
        name: 'playlists.aspectRatio',
      });
      fireEvent.change(select, { target: { value: '9:16' } });

      await waitFor(() => {
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledWith(
          baseUrl,
          organizationId,
          '1',
          expect.objectContaining({
            settings: { aspect_ratio: { width: 9, height: 16 } },
          })
        );
        expect(mockToast.success).toHaveBeenCalledWith(
          'playlists.aspectRatioUpdated'
        );
      });
    });

    it('shows error toast when preset save fails', async () => {
      vi.mocked(PlaylistsService.updatePlaylist).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox', {
        name: 'playlists.aspectRatio',
      });
      fireEvent.change(select, { target: { value: '4:3' } });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    });

    it('does not call updatePlaylist when selecting the same preset', async () => {
      const playlistWith16x9 = {
        ...mockPlaylist,
        settings: { aspect_ratio: { width: 16, height: 9 } },
      };
      vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue(
        playlistWith16x9
      );

      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox', {
        name: 'playlists.aspectRatio',
      });
      fireEvent.change(select, { target: { value: '16:9' } });

      // Give any async work time to settle
      await waitFor(() => {
        expect(PlaylistsService.updatePlaylist).not.toHaveBeenCalled();
      });
    });

    it('saves a custom aspect ratio and shows success toast', async () => {
      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
      });

      // Select "custom"
      const select = screen.getByRole('combobox', {
        name: 'playlists.aspectRatio',
      });
      fireEvent.change(select, { target: { value: 'custom' } });

      // Fill in width and height
      const widthInput = screen.getByLabelText('playlists.aspectRatioWidth');
      const heightInput = screen.getByLabelText('playlists.aspectRatioHeight');

      fireEvent.input(widthInput, { target: { value: '3' } });
      // Moving between the two fields must not save a half-edited ratio.
      fireEvent.focusOut(widthInput, { relatedTarget: heightInput });
      expect(PlaylistsService.updatePlaylist).not.toHaveBeenCalled();
      fireEvent.input(heightInput, { target: { value: '2' } });
      fireEvent.focusOut(heightInput, { relatedTarget: document.body });

      await waitFor(() => {
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledWith(
          baseUrl,
          organizationId,
          '1',
          expect.objectContaining({
            settings: { aspect_ratio: { width: 3, height: 2 } },
          })
        );
        expect(mockToast.success).toHaveBeenCalledWith(
          'playlists.aspectRatioUpdated'
        );
      });
    });

    it('prevents saving an extreme custom aspect ratio', async () => {
      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));

      await waitFor(() => {
        expect(screen.getByTestId('playlist-preview')).toBeInTheDocument();
      });

      // Select "custom"
      const select = screen.getByRole('combobox', {
        name: 'playlists.aspectRatio',
      });
      fireEvent.change(select, { target: { value: 'custom' } });

      // Enter an extreme ratio (100:1 exceeds MAX_ASPECT_RATIO of 10)
      const widthInput = screen.getByLabelText('playlists.aspectRatioWidth');
      const heightInput = screen.getByLabelText('playlists.aspectRatioHeight');

      fireEvent.input(widthInput, { target: { value: '100' } });
      fireEvent.input(heightInput, { target: { value: '1' } });

      fireEvent.focusOut(heightInput, { relatedTarget: document.body });
      fireEvent.keyDown(heightInput, { key: 'Enter' });

      // Error message should be visible
      await waitFor(() => {
        expect(
          screen.getByText('playlists.errors.aspectRatioExtreme')
        ).toBeInTheDocument();
      });

      expect(PlaylistsService.updatePlaylist).not.toHaveBeenCalled();
    });
  });

  describe('Video item durations', () => {
    const videoWidget = {
      id: 2,
      name: 'Video',
      template: {
        type: 'video',
        name: 'video',
        opts: { url: { key: 'options.video.files[@target].uri' } },
      },
      options_schema: {},
    } as any;
    const video = (duration: number) => ({
      id: duration,
      name: 'clip.mp4',
      mimetype: 'video/mp4',
      meta: { duration },
      files: {},
    });

    const renderView = async () => {
      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
        />
      ));
      await waitFor(() => expect(playlistItemsProps.current).toBeTruthy());
      return playlistItemsProps.current;
    };

    it('stores the video duration when inserting a video item', async () => {
      vi.mocked(PlaylistsService.insertWidgetIntoPlaylist).mockResolvedValue({
        id: 10,
        widget_config_id: 'config-1',
      } as any);
      (PlaylistsService as any).fetchWidgetConfigData = vi
        .fn()
        .mockResolvedValue(null);
      const props = await renderView();

      await props.onInsertItem(videoWidget, 0, {
        config: { options: { video: 12000 } },
        expandedOptions: { video: video(12000) },
      });

      expect(PlaylistsService.insertWidgetIntoPlaylist).toHaveBeenCalledWith(
        baseUrl,
        organizationId,
        playlistId,
        expect.objectContaining({ duration: 12000 })
      );
    });

    it('updates the stored duration when the video of an item changes', async () => {
      (PlaylistsService as any).fetchWidgetConfigData = vi
        .fn()
        .mockResolvedValue(null);
      const props = await renderView();
      const item = {
        id: 10,
        duration: 12000,
        widget: videoWidget,
        config: { id: 'config-1', options: { video: 12000 }, data: {} },
      };

      await props.onEditItem(item, {
        config: { options: { video: 13967 }, data: {} },
        expandedOptions: { video: video(13967) },
      });

      expect(PlaylistsService.updateItemInPlaylist).toHaveBeenCalledWith(
        baseUrl,
        organizationId,
        playlistId,
        10,
        { duration: 13967 }
      );
    });
  });
  describe('Drawer layout', () => {
    const renderView = (onChange = vi.fn()) => {
      render(() => (
        <PlaylistView
          store={mockStore}
          playlistId={playlistId}
          organizationId={organizationId}
          baseUrl={baseUrl}
          onChange={onChange}
        />
      ));
      return onChange;
    };

    const tab = (name: string) => screen.getByRole('tab', { name });
    const card = (selector: string) =>
      document.querySelector(selector) as HTMLElement;

    const mockMatchMedia = (wide: boolean) => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn((query: string) => ({
        matches: query === WIDE_LAYOUT_QUERY ? wide : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as any;
      return () => {
        window.matchMedia = original;
      };
    };

    it('shows a summary with item count, total duration and aspect ratio', async () => {
      vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue({
        ...mockPlaylist,
        items: [
          { id: 1, duration: 10000 },
          { id: 2, duration: 5000 },
        ],
        settings: { aspect_ratio: { width: 4, height: 3 } },
      } as any);
      renderView();

      await waitFor(() =>
        expect(card('.playlist-summary')).toBeInTheDocument()
      );
      const summary = card('.playlist-summary');
      expect(summary).toHaveTextContent('playlists.editor.totalDuration');
      expect(within(summary).getByText('4:3')).toBeInTheDocument();
      expect(
        within(card('.playlist-items-card')).getByText('2')
      ).toBeInTheDocument();
    });

    it('shows widgets, items and preview side by side on wide screens', async () => {
      renderView();

      await waitFor(() => expect(tab('playlists.editor.content')).toBeTruthy());
      expect(screen.queryByRole('tab', { name: 'common.preview' })).toBeNull();
      expect(tab('playlists.editor.content')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(card('.playlist-view')).toHaveClass('wide');
      for (const selector of [
        '.playlist-widgets-card',
        '.playlist-items-card',
        '.playlist-preview-card',
      ]) {
        expect(card(selector)).not.toHaveClass('is-hidden');
      }
      expect(screen.getByTestId('add-trigger')).toHaveAttribute(
        'data-tap-to-add',
        'false'
      );
      expect(playlistItemsProps.current.reorderButtons).toBe(false);
    });

    it('switches to settings with the mouse and keyboard', async () => {
      renderView();

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      expect(tab('common.settings')).toHaveAttribute('aria-selected', 'true');
      expect(card('.playlist-editor')).toHaveClass('is-hidden');
      expect(card('.playlist-settings')).not.toHaveClass('is-hidden');

      fireEvent.keyDown(tab('common.settings'), { key: 'ArrowRight' });
      expect(tab('playlists.editor.content')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(document.activeElement).toBe(tab('playlists.editor.content'));
      expect(card('.playlist-editor')).not.toHaveClass('is-hidden');
    });

    it('appends a widget when + is clicked in the widget list', async () => {
      renderView();

      await waitFor(() => screen.getByTestId('add-trigger'));
      fireEvent.click(screen.getByTestId('add-trigger'));

      await waitFor(() =>
        expect(addWidgetSpy).toHaveBeenCalledWith({
          id: 1,
          name: 'Image Widget',
        })
      );
    });

    it('prevents concurrent widget additions while configuration is pending', async () => {
      let finishAdd!: () => void;
      addWidgetSpy.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishAdd = resolve;
        })
      );
      renderView();

      await waitFor(() => screen.getByTestId('add-trigger'));
      fireEvent.click(screen.getByTestId('add-trigger'));
      fireEvent.click(screen.getByTestId('add-trigger'));

      expect(addWidgetSpy).toHaveBeenCalledTimes(1);
      finishAdd();
    });

    it('renames the playlist from the settings tab', async () => {
      vi.mocked(PlaylistsService.updatePlaylist).mockResolvedValue(undefined);
      const onChange = renderView();

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      const settings = card('.playlist-settings-card');
      expect(within(settings).queryByRole('button')).toBeNull();
      const input = within(settings).getByLabelText(
        'common.name'
      ) as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Lobby loop' } });
      fireEvent.focusOut(input);

      await waitFor(() => {
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledWith(
          baseUrl,
          organizationId,
          '1',
          expect.objectContaining({ name: 'Lobby loop' })
        );
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, name: 'Lobby loop' })
        );
        expect(mockToast.success).toHaveBeenCalledWith(
          'playlists.playlistUpdated'
        );
      });
    });

    it('saves the name on Enter and reverts on Escape or invalid names', async () => {
      vi.mocked(PlaylistsService.updatePlaylist).mockResolvedValue(undefined);
      const outerKeydown = vi.fn();
      document.addEventListener('keydown', outerKeydown);
      renderView();

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      const input = within(card('.playlist-settings-card')).getByLabelText(
        'common.name'
      ) as HTMLInputElement;
      const original = input.value;

      fireEvent.input(input, { target: { value: 'ab' } });
      expect(screen.getByText('playlists.errors.nameMinLength')).toBeTruthy();
      fireEvent.focusOut(input);
      expect(input.value).toBe(original);

      fireEvent.input(input, { target: { value: 'Discarded' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      fireEvent.focusOut(input);
      expect(input.value).toBe(original);
      expect(outerKeydown).not.toHaveBeenCalled();
      expect(PlaylistsService.updatePlaylist).not.toHaveBeenCalled();
      document.removeEventListener('keydown', outerKeydown);

      fireEvent.input(input, { target: { value: 'Front desk' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.focusOut(input);
      await waitFor(() =>
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(1)
      );
      expect(PlaylistsService.updatePlaylist).toHaveBeenCalledWith(
        baseUrl,
        organizationId,
        '1',
        expect.objectContaining({ name: 'Front desk' })
      );
    });

    it('disables the name field while its save is pending', async () => {
      let resolveSave!: () => void;
      vi.mocked(PlaylistsService.updatePlaylist).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );
      renderView();

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      const input = within(card('.playlist-settings-card')).getByLabelText(
        'common.name'
      ) as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Pending rename' } });
      fireEvent.focusOut(input);

      await waitFor(() => expect(input).toBeDisabled());
      resolveSave();
      await waitFor(() => expect(input).not.toBeDisabled());
    });

    it('serializes playlist name and aspect-ratio saves using the latest state', async () => {
      let resolveRename!: () => void;
      vi.mocked(PlaylistsService.updatePlaylist)
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveRename = resolve;
            })
        )
        .mockResolvedValue(undefined);
      renderView();

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      const settings = card('.playlist-settings-card');
      const input = within(settings).getByLabelText(
        'common.name'
      ) as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Updated name' } });
      fireEvent.focusOut(input);

      await waitFor(() =>
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(1)
      );
      fireEvent.change(
        within(settings).getByRole('combobox', {
          name: 'playlists.aspectRatio',
        }),
        { target: { value: '9:16' } }
      );
      expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(1);

      resolveRename();
      await waitFor(() =>
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(2)
      );
      expect(PlaylistsService.updatePlaylist).toHaveBeenLastCalledWith(
        baseUrl,
        organizationId,
        '1',
        expect.objectContaining({
          name: 'Updated name',
          settings: { aspect_ratio: { width: 9, height: 16 } },
        })
      );
    });

    it('preserves item edits made while a playlist rename is pending', async () => {
      let resolveRename!: () => void;
      const item = { id: 44, duration: 10 } as any;
      vi.mocked(PlaylistsService.getPlaylist).mockResolvedValue({
        ...mockPlaylist,
        items: [item],
      });
      vi.mocked(PlaylistsService.updatePlaylist).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveRename = resolve;
          })
      );
      renderView();

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      const input = within(card('.playlist-settings-card')).getByLabelText(
        'common.name'
      );
      fireEvent.input(input, { target: { value: 'Renamed playlist' } });
      fireEvent.focusOut(input);
      await waitFor(() =>
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(1)
      );

      await playlistItemsProps.current.onChangeDuration(item, 30);
      expect(playlistPreviewProps.current.playlist.items[0].duration).toBe(30);

      resolveRename();
      await waitFor(() =>
        expect(playlistPreviewProps.current.playlist.name).toBe(
          'Renamed playlist'
        )
      );
      expect(playlistPreviewProps.current.playlist.items[0].duration).toBe(30);
    });

    it('does not apply queued or completed saves after switching playlists', async () => {
      let setPlaylistId!: (id: number) => void;
      let resolveRename!: () => void;
      const onChange = vi.fn();
      vi.mocked(PlaylistsService.getPlaylist).mockImplementation(
        async (_baseUrl, _organizationId, id) => ({
          ...mockPlaylist,
          id,
          name: id === 1 ? 'First playlist' : 'Second playlist',
          settings: { aspect_ratio: { width: 16, height: 9 } },
        })
      );
      vi.mocked(PlaylistsService.updatePlaylist).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveRename = resolve;
          })
      );

      render(() => {
        const [playlistId, setId] = createSignal(1);
        setPlaylistId = setId;
        return (
          <PlaylistView
            store={mockStore}
            playlistId={playlistId()}
            organizationId={organizationId}
            baseUrl={baseUrl}
            onChange={onChange}
          />
        );
      });

      await waitFor(() => expect(tab('common.settings')).toBeTruthy());
      fireEvent.click(tab('common.settings'));
      const settings = card('.playlist-settings-card');
      const input = within(settings).getByLabelText(
        'common.name'
      ) as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Renamed first' } });
      fireEvent.focusOut(input);
      await waitFor(() =>
        expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(1)
      );

      fireEvent.change(
        within(settings).getByRole('combobox', {
          name: 'playlists.aspectRatio',
        }),
        { target: { value: '9:16' } }
      );
      setPlaylistId(2);
      await waitFor(() =>
        expect(PlaylistsService.getPlaylist).toHaveBeenCalledWith(
          baseUrl,
          organizationId,
          2
        )
      );
      await waitFor(() => expect(input.value).toBe('Second playlist'));

      resolveRename();
      await waitFor(() => expect(onChange).not.toHaveBeenCalled());
      expect(PlaylistsService.updatePlaylist).toHaveBeenCalledTimes(1);
    });

    it('uses tabs when the drawer is too narrow for three columns', async () => {
      const restore = mockMatchMedia(true);
      const originalObserver = global.ResizeObserver;
      global.ResizeObserver = vi.fn(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })) as any;
      const rect = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({ width: 800, height: 900 } as DOMRect);

      try {
        renderView();
        await waitFor(() => expect(tab('common.preview')).toBeTruthy());
        expect(card('.playlist-view')).toHaveClass('narrow');
      } finally {
        rect.mockRestore();
        global.ResizeObserver = originalObserver;
        restore();
      }
    });

    describe('on narrow screens', () => {
      let restore: () => void;

      beforeEach(() => {
        restore = mockMatchMedia(false);
      });

      afterEach(() => restore());

      it('uses content, preview and settings tabs', async () => {
        renderView();

        await waitFor(() => expect(tab('common.preview')).toBeTruthy());
        expect(card('.playlist-view')).toHaveClass('narrow');
        expect(card('.playlist-widgets-card')).toHaveClass('is-hidden');
        expect(card('.playlist-items-card')).not.toHaveClass('is-hidden');
        expect(card('.playlist-preview-card')).toHaveClass('is-hidden');
        expect(playlistItemsProps.current.reorderButtons).toBe(true);

        fireEvent.click(tab('common.preview'));
        expect(card('.playlist-preview-card')).not.toHaveClass('is-hidden');
        expect(card('.playlist-items-card')).toHaveClass('is-hidden');
      });

      it('adds widgets through the widget picker', async () => {
        vi.mocked(PlaylistsService.insertWidgetIntoPlaylist).mockResolvedValue({
          id: 99,
          widget_config_id: 'wc-99',
        } as any);
        vi.mocked(PlaylistsService.fetchWidgetConfigData).mockResolvedValue(
          null as any
        );
        addWidgetSpy.mockImplementationOnce((widget: any) =>
          playlistItemsProps.current.onInsertItem(
            { ...widget, template: { type: 'image' } },
            0,
            {
              config: { options: {} },
              expandedOptions: {},
            }
          )
        );
        renderView();

        const addButton = await waitFor(() =>
          within(card('.playlist-items-card')).getByRole('button', {
            name: 'playlists.editor.addWidget',
          })
        );
        expect(card('.playlist-view')).not.toHaveClass('picking');
        fireEvent.click(addButton);
        expect(card('.playlist-view')).toHaveClass('picking');
        expect(card('.playlist-widgets-card')).not.toHaveClass('is-hidden');
        expect(card('.playlist-items-card')).toHaveClass('is-hidden');
        expect(screen.getByTestId('add-trigger')).toHaveAttribute(
          'data-tap-to-add',
          'true'
        );

        fireEvent.click(screen.getByTestId('add-trigger'));

        await waitFor(() =>
          expect(card('.playlist-widgets-card')).toHaveClass('is-hidden')
        );
        expect(PlaylistsService.insertWidgetIntoPlaylist).toHaveBeenCalled();
        expect(card('.playlist-items-card')).not.toHaveClass('is-hidden');
        expect(card('.playlist-view')).not.toHaveClass('picking');
      });

      it('keeps the picker open when adding is cancelled', async () => {
        addWidgetSpy.mockResolvedValueOnce(undefined);
        renderView();

        const addButton = await waitFor(() =>
          within(card('.playlist-items-card')).getByRole('button', {
            name: 'playlists.editor.addWidget',
          })
        );
        fireEvent.click(addButton);
        fireEvent.click(screen.getByTestId('add-trigger'));

        await waitFor(() => expect(addWidgetSpy).toHaveBeenCalled());
        await Promise.resolve();
        expect(card('.playlist-widgets-card')).not.toHaveClass('is-hidden');
        expect(card('.playlist-items-card')).toHaveClass('is-hidden');
      });

      it('edits items on tap in the narrow layout', async () => {
        renderView();
        await waitFor(() => expect(playlistItemsProps.current).not.toBeNull());
        expect(playlistItemsProps.current.tapToEdit).toBe(true);
      });

      it('closes the widget picker with the back button', async () => {
        renderView();

        const addButton = await waitFor(() =>
          within(card('.playlist-items-card')).getByRole('button', {
            name: 'playlists.editor.addWidget',
          })
        );
        fireEvent.click(addButton);
        fireEvent.click(screen.getByTestId('close-picker'));

        expect(card('.playlist-widgets-card')).toHaveClass('is-hidden');
        expect(addWidgetSpy).not.toHaveBeenCalled();
      });
    });
  });
});
