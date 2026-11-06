import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import type { JsonPlaylistItem, JsonWidget } from '@castmill/player';
import { PlaylistItems } from './playlist-items';
import { PlaylistsService } from '../services/playlists.service';

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  draggable: vi.fn(() => () => {}),
  dropTargetForElements: vi.fn(() => () => {}),
}));

vi.mock('../services/playlists.service', () => ({
  PlaylistsService: {
    prefetchWidgetData: vi.fn(),
    checkWidgetCredentials: vi.fn(),
  },
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

vi.mock('./widget-config', () => ({
  WidgetConfig: (props: any) => (
    <div data-testid="widget-config">
      <button onClick={() => props.onDirtyChange?.(true)}>make-dirty</button>
      <button onClick={() => props.onCancel?.()}>cancel-config</button>
    </div>
  ),
}));

const widget = (id: number, name: string) =>
  ({
    id,
    name,
    slug: name.toLowerCase(),
    template: {},
    options_schema: {},
    default_config: {},
  }) as unknown as JsonWidget;

const item = (id: number) =>
  ({
    id,
    duration: 10000,
    offset: 0,
    config: { options: {} },
    widget: widget(id, `Widget ${id}`),
  }) as unknown as JsonPlaylistItem;

describe('PlaylistItems', () => {
  const items = [item(1), item(2), item(3)];

  const renderItems = (overrides: Record<string, unknown> = {}) => {
    const props = {
      store: {} as any,
      baseUrl: 'http://localhost:4000',
      organizationId: 'org-1',
      playlistId: 1,
      items,
      onEditItem: vi.fn(),
      onInsertItem: vi.fn(),
      onMoveItem: vi.fn(),
      onRemoveItem: vi.fn(),
      onChangeDuration: vi.fn(),
      ...overrides,
    };
    render(() => <PlaylistItems {...(props as any)} />);
    return props as typeof props & Record<string, any>;
  };

  const buttons = (name: string) => screen.getAllByRole('button', { name });
  // Modal content is aria-hidden until its open transition finishes.
  const dialogButton = (name: string) =>
    screen.getByLabelText(name, { selector: 'button' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PlaylistsService.prefetchWidgetData).mockResolvedValue(
      undefined as any
    );
    vi.mocked(PlaylistsService.checkWidgetCredentials).mockResolvedValue({
      configured: true,
      missing_integrations: [],
    } as any);
  });

  it('moves items with drop-equivalent indexes', () => {
    const props = renderItems({ reorderButtons: true });

    fireEvent.click(buttons('playlists.editor.moveUp')[1]);
    expect(props.onMoveItem).toHaveBeenLastCalledWith(items[1], 1, 0);

    fireEvent.click(buttons('playlists.editor.moveDown')[0]);
    expect(props.onMoveItem).toHaveBeenLastCalledWith(items[0], 0, 2);

    // Moving the second-to-last item down appends it.
    fireEvent.click(buttons('playlists.editor.moveDown')[1]);
    expect(props.onMoveItem).toHaveBeenLastCalledWith(items[1], 1, undefined);

    expect(buttons('playlists.editor.moveUp')[0]).toBeDisabled();
    expect(buttons('playlists.editor.moveDown')[2]).toBeDisabled();
  });

  it('scrolls the moved item into view after a button move', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderItems({ reorderButtons: true });

    fireEvent.click(buttons('playlists.editor.moveDown')[0]);

    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
  });

  it('omits move buttons when reordering is drag-only', () => {
    renderItems();

    expect(
      screen.queryByRole('button', { name: 'playlists.editor.moveUp' })
    ).toBeNull();
  });

  it('registers an add function that appends widgets without options', async () => {
    let add: ((w: JsonWidget, index?: number) => Promise<void>) | undefined;
    const props = renderItems({
      onAddWidgetReady: (fn: typeof add) => (add = fn),
    });
    const newWidget = widget(9, 'Clock');

    await add!(newWidget);

    expect(props.onInsertItem).toHaveBeenCalledWith(newWidget, 3, {
      config: { options: {} },
      expandedOptions: {},
    });
  });

  it('reports missing credentials instead of adding the widget', async () => {
    vi.mocked(PlaylistsService.checkWidgetCredentials).mockResolvedValue({
      configured: false,
      missing_integrations: ['spotify'],
    } as any);
    let add: ((w: JsonWidget, index?: number) => Promise<void>) | undefined;
    const props = renderItems({
      onAddWidgetReady: (fn: typeof add) => (add = fn),
      onCredentialsError: vi.fn(),
    });

    await add!(widget(9, 'Spotify'), 0);

    expect(props.onInsertItem).not.toHaveBeenCalled();
    expect(props.onCredentialsError).toHaveBeenCalledWith(
      expect.objectContaining({ missingIntegrations: ['spotify'] })
    );
  });

  it('shows the empty state when there are no items', async () => {
    renderItems({ items: [], emptyContent: <p>Nothing here</p> });

    await waitFor(() =>
      expect(screen.getByText('Nothing here')).toBeInTheDocument()
    );
  });

  it('asks for confirmation before removing an item', async () => {
    const props = renderItems();

    fireEvent.click(buttons('playlists.editor.removeItem')[1]);
    expect(props.onRemoveItem).not.toHaveBeenCalled();
    expect(
      screen.getByText('playlists.editor.removeItemMessage')
    ).toBeInTheDocument();

    fireEvent.click(dialogButton('common.remove'));
    await waitFor(() =>
      expect(props.onRemoveItem).toHaveBeenCalledWith(items[1])
    );
  });

  it('keeps the item when removal is cancelled', async () => {
    const props = renderItems();

    fireEvent.click(buttons('playlists.editor.removeItem')[0]);
    fireEvent.click(dialogButton('common.cancel'));

    await waitFor(() =>
      expect(
        screen.queryByText('playlists.editor.removeItemMessage')
      ).toBeNull()
    );
    expect(props.onRemoveItem).not.toHaveBeenCalled();
  });

  it('opens the editor on row tap when tapToEdit is set', async () => {
    const onSeekToItem = vi.fn();
    renderItems({ tapToEdit: true, onSeekToItem });

    fireEvent.click(screen.getAllByText('Widget 2')[0]);

    expect(await screen.findByTestId('widget-config')).toBeInTheDocument();
    expect(onSeekToItem).not.toHaveBeenCalled();
  });

  it('seeks the preview on row tap by default', () => {
    const onSeekToItem = vi.fn();
    renderItems({ onSeekToItem });

    fireEvent.click(screen.getAllByText('Widget 2')[0]);

    expect(onSeekToItem).toHaveBeenCalledWith(1);
    expect(screen.queryByTestId('widget-config')).toBeNull();
  });

  it('confirms before discarding unsaved widget changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const props = renderItems();
      fireEvent.click(buttons('playlists.editor.editItem')[0]);
      await screen.findByTestId('widget-config');

      fireEvent.click(screen.getByText('make-dirty'));
      fireEvent.click(screen.getByText('cancel-config'));
      expect(
        screen.getByText('playlists.editor.discardChangesMessage')
      ).toBeInTheDocument();

      fireEvent.click(dialogButton('playlists.editor.keepEditing'));
      await vi.advanceTimersByTimeAsync(400);
      expect(screen.getByTestId('widget-config')).toBeInTheDocument();

      fireEvent.click(screen.getByText('cancel-config'));
      fireEvent.click(dialogButton('playlists.editor.discard'));
      await vi.advanceTimersByTimeAsync(400);

      expect(screen.queryByTestId('widget-config')).toBeNull();
      expect(props.onEditItem).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
