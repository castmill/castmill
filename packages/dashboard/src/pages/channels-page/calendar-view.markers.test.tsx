import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { CalendarView } from './calendar-view';
import type { JsonChannel } from '../../services/channels.service';

const getChannelEntries = vi.fn().mockResolvedValue([]);
let reportPlaylists:
  | ((playlists: { id: number; name: string }[]) => void)
  | undefined;

vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    getChannelEntries = getChannelEntries;
  },
}));
vi.mock('./playlist-chooser', () => ({
  PlaylistChooser: (props: { onPlaylistsLoaded?: typeof reportPlaylists }) => {
    reportPlaylists = props.onPlaylistsLoaded;
    return null;
  },
}));
vi.mock('./default-playlist-combobox', () => ({
  DefaultPlaylistComboBox: () => null,
}));
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  };
});
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

const channel = { id: 3, name: 'Main', timezone: 'UTC' } as JsonChannel;

describe('CalendarView automation markers', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reports the visible week and draws markers inside it', async () => {
    const onWeekChange = vi.fn();
    const now = Date.now();
    render(() => (
      <I18nProvider>
        <CalendarView
          channel={channel}
          timeZone="UTC"
          onWeekChange={onWeekChange}
          markers={[
            { time: now, label: 'Spring campaign now' },
            { time: now - 30 * 24 * 3600 * 1000, label: 'Long ago' },
          ]}
        />
      </I18nProvider>
    ));

    await waitFor(() => expect(onWeekChange).toHaveBeenCalled());
    const [start, end] = onWeekChange.mock.lastCall!;
    expect(start).toBeLessThanOrEqual(now);
    expect(end).toBeGreaterThan(now);

    const markers = screen.getAllByTestId('automation-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute('aria-label', 'Spring campaign now');
  });

  it('renders no marker layer without markers', () => {
    render(() => (
      <I18nProvider>
        <CalendarView channel={channel} timeZone="UTC" />
      </I18nProvider>
    ));
    expect(screen.queryByTestId('automation-marker')).not.toBeInTheDocument();
  });

  it('shows the playlist name of each entry', async () => {
    const start = new Date().setUTCHours(10, 0, 0, 0);
    getChannelEntries.mockResolvedValueOnce([
      {
        id: 1,
        playlist_id: 7,
        start,
        end: start + 3600 * 1000,
        repeat_weekly_until: null,
      },
    ]);
    render(() => (
      <I18nProvider>
        <CalendarView channel={channel} timeZone="UTC" />
      </I18nProvider>
    ));
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    reportPlaylists?.([
      { id: 7, name: 'Lunch menu' },
      { id: 8, name: 'Happy hour' },
    ]);

    expect(await screen.findByText('Lunch menu')).toBeInTheDocument();
    expect(screen.queryByText('Happy hour')).not.toBeInTheDocument();
  });
});
