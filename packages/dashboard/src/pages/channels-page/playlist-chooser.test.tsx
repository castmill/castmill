import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@solidjs/testing-library';
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
});
