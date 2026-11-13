import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { PlaylistChooser } from './playlist-chooser';

const fetchPlaylists = vi.fn().mockResolvedValue({
  data: [
    { id: 1, name: 'Morning' },
    { id: 2, name: 'Evening' },
  ],
  count: 2,
});

vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylists = fetchPlaylists;
  },
}));
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

describe('PlaylistChooser', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the side panel with a heading by default', async () => {
    const { container } = render(() => (
      <I18nProvider>
        <PlaylistChooser />
      </I18nProvider>
    ));

    expect(
      screen.getByRole('heading', { name: 'Drag playlists' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();
    expect(container.firstElementChild!.className).toBe('');
  });

  it('renders a compact strip without a heading', async () => {
    const { container } = render(() => (
      <I18nProvider>
        <PlaylistChooser variant="strip" />
      </I18nProvider>
    ));

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Drag playlists')).toBeInTheDocument();
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(container.firstElementChild!.className).toMatch(/strip/);
  });
});
