import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { PlaylistChooser } from './playlist-chooser';

const mocks = vi.hoisted(() => ({
  fetchPlaylists: vi.fn(),
}));

vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylists = mocks.fetchPlaylists;
  },
}));

describe('PlaylistChooser', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reports playlists from every page', async () => {
    mocks.fetchPlaylists
      .mockResolvedValueOnce({
        data: [{ id: 1, name: 'First playlist' }],
        count: 101,
      })
      .mockResolvedValueOnce({
        data: [{ id: 101, name: 'Last playlist' }],
        count: 101,
      });
    const onPlaylistsLoaded = vi.fn();

    render(() => (
      <I18nProvider>
        <PlaylistChooser onPlaylistsLoaded={onPlaylistsLoaded} />
      </I18nProvider>
    ));

    await waitFor(() =>
      expect(onPlaylistsLoaded).toHaveBeenCalledWith([
        { id: 1, name: 'First playlist' },
        { id: 101, name: 'Last playlist' },
      ])
    );
    expect(mocks.fetchPlaylists).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: { num: 2, size: 100 } })
    );
  });

  it('keeps successful pages and retries only failed pages', async () => {
    mocks.fetchPlaylists
      .mockResolvedValueOnce({
        data: [{ id: 1, name: 'First playlist' }],
        count: 201,
      })
      .mockRejectedValueOnce(new Error('Page unavailable'))
      .mockResolvedValueOnce({
        data: [{ id: 201, name: 'Last playlist' }],
        count: 201,
      })
      .mockResolvedValueOnce({
        data: [{ id: 101, name: 'Middle playlist' }],
        count: 201,
      });
    const onPlaylistsLoaded = vi.fn();

    render(() => (
      <I18nProvider>
        <PlaylistChooser onPlaylistsLoaded={onPlaylistsLoaded} />
      </I18nProvider>
    ));

    await waitFor(() =>
      expect(onPlaylistsLoaded).toHaveBeenCalledWith([
        { id: 1, name: 'First playlist' },
        { id: 201, name: 'Last playlist' },
      ])
    );
    expect(screen.getByRole('alert').textContent).toContain('pages: 2');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(onPlaylistsLoaded).toHaveBeenLastCalledWith([
        { id: 1, name: 'First playlist' },
        { id: 101, name: 'Middle playlist' },
        { id: 201, name: 'Last playlist' },
      ])
    );
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(mocks.fetchPlaylists).toHaveBeenCalledTimes(4);
    expect(mocks.fetchPlaylists).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: { num: 2, size: 100 } })
    );
  });

  it('retries the first page before loading the remaining pages', async () => {
    mocks.fetchPlaylists
      .mockRejectedValueOnce(new Error('Page unavailable'))
      .mockResolvedValueOnce({
        data: [{ id: 1, name: 'First playlist' }],
        count: 101,
      })
      .mockResolvedValueOnce({
        data: [{ id: 101, name: 'Last playlist' }],
        count: 101,
      });
    const onPlaylistsLoaded = vi.fn();

    render(() => (
      <I18nProvider>
        <PlaylistChooser onPlaylistsLoaded={onPlaylistsLoaded} />
      </I18nProvider>
    ));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('pages: 1')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(onPlaylistsLoaded).toHaveBeenLastCalledWith([
        { id: 1, name: 'First playlist' },
        { id: 101, name: 'Last playlist' },
      ])
    );
  });
});
