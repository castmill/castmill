import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import {
  CalendarView,
  DAY_VIEW_QUERY,
  WIDE_CALENDAR_QUERY,
} from './calendar-view';
import { durationOptions } from './calendar-add-entry';
import type { JsonChannel } from '../../services/channels.service';

const getChannelEntries = vi.fn();
const addEntryToChannel = vi.fn();
const toastError = vi.fn();
const fetchPlaylists = vi.fn();

vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    getChannelEntries = getChannelEntries;
    addEntryToChannel = addEntryToChannel;
    fetchPlaylists = fetchPlaylists;
  },
}));
vi.mock('./playlist-chooser', () => ({
  PlaylistChooser: (props: { variant?: string }) => (
    <div
      data-testid="playlist-chooser"
      data-variant={props.variant ?? 'panel'}
    />
  ),
}));
vi.mock('./default-playlist-combobox', () => ({
  DefaultPlaylistComboBox: () => null,
}));
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: toastError, info: vi.fn() }),
    // The real ComboBox is covered in ui-common; pick a playlist directly.
    ComboBox: (props: {
      label: string;
      onSelect: (item: unknown) => void;
      fetchItems: (page: number, size: number, search: string) => unknown;
    }) => {
      props.fetchItems(1, 10, 'pro');
      return (
        <button
          type="button"
          onClick={() => props.onSelect({ id: 7, name: 'Promo' })}
        >
          {props.label}
        </button>
      );
    },
  };
});
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

const channel = { id: 3, name: 'Main', timezone: 'UTC' } as JsonChannel;

/** Sunday 2026-01-11 12:00 UTC; its week starts on Monday 2026-01-05. */
const NOW = new Date('2026-01-11T12:00:00Z');
const WEEK_START = Date.UTC(2026, 0, 5);
const DAY_MS = 24 * 3600 * 1000;

const mockViewport = (matching: string[]) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
};

const DESKTOP = [WIDE_CALENDAR_QUERY];
const TABLET_PORTRAIT: string[] = [];
const TABLET_LANDSCAPE = [WIDE_CALENDAR_QUERY, '(pointer: coarse)'];
const PHONE = [DAY_VIEW_QUERY, '(pointer: coarse)'];

const renderCalendar = (
  options: {
    onWeekChange?: (s: number, e: number) => void;
    dir?: 'ltr' | 'rtl';
  } = {}
) =>
  render(() => (
    <I18nProvider>
      <div dir={options.dir ?? 'ltr'}>
        <CalendarView
          channel={channel}
          timeZone="UTC"
          onWeekChange={options.onWeekChange}
        />
      </div>
    </I18nProvider>
  ));

const layout = (container: HTMLElement) =>
  container.querySelector('[data-layout]')!.getAttribute('data-layout');

const rangeText = () => screen.getByTestId('calendar-range').textContent;

const swipe = (dx: number, dy = 0) => {
  const body = screen.getByTestId('calendar-body');
  fireEvent.touchStart(body, { touches: [{ clientX: 200, clientY: 200 }] });
  fireEvent.touchEnd(body, {
    changedTouches: [{ clientX: 200 + dx, clientY: 200 + dy }],
  });
};

describe('CalendarView responsive layouts', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    getChannelEntries.mockResolvedValue([]);
    addEntryToChannel.mockResolvedValue({ id: 99 });
    fetchPlaylists.mockResolvedValue({ data: [], count: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it('keeps the side panel and week grid on desktop', () => {
    mockViewport(DESKTOP);
    const { container } = renderCalendar();

    expect(layout(container)).toBe('wide');
    expect(screen.getAllByTestId('calendar-day-header')).toHaveLength(7);
    expect(screen.getByTestId('playlist-chooser')).toHaveAttribute(
      'data-variant',
      'panel'
    );
    expect(
      screen.queryByRole('button', { name: 'Playlists' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('calendar-slot')).toHaveLength(48 * 7);
  });

  it('renders localized navigation without the old Events button', () => {
    mockViewport(DESKTOP);
    renderCalendar();

    expect(screen.getByRole('button', { name: 'Previous week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(screen.queryByText('Events')).not.toBeInTheDocument();
    expect(screen.queryByText('prev')).not.toBeInTheDocument();
  });

  it('pages whole weeks outside the day view', async () => {
    mockViewport(DESKTOP);
    const onWeekChange = vi.fn();
    renderCalendar({ onWeekChange });
    await waitFor(() =>
      expect(onWeekChange).toHaveBeenLastCalledWith(
        WEEK_START,
        WEEK_START + 7 * DAY_MS - 1
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START + 7 * DAY_MS);

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START - 7 * DAY_MS);

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START);

    // Swipes only page the phone day view.
    const before = rangeText();
    swipe(-120);
    expect(rangeText()).toBe(before);
  });

  it.each([
    ['portrait', TABLET_PORTRAIT],
    ['landscape (touch)', TABLET_LANDSCAPE],
  ])(
    'shows a collapsible playlist strip above the week on %s tablets',
    (_, viewport) => {
      mockViewport(viewport);
      const { container } = renderCalendar();

      expect(layout(container)).toBe('narrow');
      expect(screen.getAllByTestId('calendar-day-header')).toHaveLength(7);
      expect(
        screen.getByText('Tap a time slot to add a playlist to the schedule.')
      ).toBeInTheDocument();

      const toggle = screen.getByRole('button', { name: 'Playlists' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('playlist-chooser')).not.toBeInTheDocument();

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('playlist-chooser')).toHaveAttribute(
        'data-variant',
        'strip'
      );

      fireEvent.click(toggle);
      expect(screen.queryByTestId('playlist-chooser')).not.toBeInTheDocument();
    }
  );

  it('shows a single day on phones and pages across weeks', async () => {
    mockViewport(PHONE);
    const onWeekChange = vi.fn();
    const { container } = renderCalendar({ onWeekChange });

    expect(layout(container)).toBe('day');
    expect(screen.getAllByTestId('calendar-day-header')).toHaveLength(1);
    expect(screen.getAllByTestId('calendar-slot')).toHaveLength(48);
    expect(rangeText()).toContain('Sunday');
    expect(
      screen.queryByRole('button', { name: 'Playlists' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('playlist-chooser')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START)
    );

    // Sunday -> Monday of the next week
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(rangeText()).toContain('Monday');
    expect(rangeText()).toContain('12');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START + 7 * DAY_MS);

    // Back to Sunday, then Saturday of the same week
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(rangeText()).toContain('Sunday');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START);
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(rangeText()).toContain('Saturday');

    // Monday -> Sunday of the previous week
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    }
    expect(rangeText()).toContain('Monday');
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(rangeText()).toContain('Sunday');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START - 7 * DAY_MS);

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(rangeText()).toContain('January 11');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START);
  });

  it('pages days by swiping, mirrored in RTL', () => {
    mockViewport(PHONE);
    renderCalendar();

    swipe(-120);
    expect(rangeText()).toContain('Monday');
    swipe(120);
    expect(rangeText()).toContain('Sunday');
    // Short or mostly vertical moves are scrolls, not swipes.
    swipe(-20);
    swipe(-80, 200);
    expect(rangeText()).toContain('Sunday');
    // A touch end without a start is ignored.
    fireEvent.touchEnd(screen.getByTestId('calendar-body'), {
      changedTouches: [{ clientX: 0, clientY: 0 }],
    });
    expect(rangeText()).toContain('Sunday');

    cleanup();
    renderCalendar({ dir: 'rtl' });
    swipe(120);
    expect(rangeText()).toContain('Monday');
    swipe(-120);
    expect(rangeText()).toContain('Sunday');
  });

  it('only shows entries that fall on the selected day', async () => {
    getChannelEntries.mockResolvedValue([
      {
        id: 5,
        playlist_id: 2,
        start: Date.UTC(2026, 0, 7, 10),
        end: Date.UTC(2026, 0, 7, 11),
        repeat_weekly_until: null,
      },
    ]);
    mockViewport(PHONE);
    renderCalendar();

    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());
    // Sunday: the Wednesday entry is hidden.
    expect(screen.queryByText('10:00-11:00')).not.toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    }
    expect(rangeText()).toContain('Wednesday');
    expect(await screen.findByText('10:00-11:00')).toBeInTheDocument();
    // Day view entries cannot be stretched across days.
    const box = screen.getByText('10:00-11:00').parentElement!.parentElement!;
    expect(box.children).toHaveLength(4);
  });
});

describe('CalendarView tap-to-add', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    getChannelEntries.mockResolvedValue([]);
    addEntryToChannel.mockResolvedValue({ id: 99 });
    fetchPlaylists.mockResolvedValue({ data: [], count: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  /** Clicks the week grid slot for `day` (0 = Monday) and half-hour `slot`. */
  const tapWeekSlot = (day: number, slot: number) =>
    fireEvent.click(screen.getAllByTestId('calendar-slot')[slot * 7 + day]);

  const pickPlaylistAndAdd = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Playlist' }));
    const add = screen.getByRole('button', { name: /Add to schedule/ });
    await waitFor(() => expect(add).not.toBeDisabled());
    fireEvent.click(add);
  };

  it('adds the picked playlist at the tapped slot', async () => {
    mockViewport(TABLET_PORTRAIT);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    // Wednesday 10:00
    tapWeekSlot(2, 20);
    expect(
      screen.getByText('Starts Wednesday, January 7 at 10:00')
    ).toBeInTheDocument();

    const add = screen.getByRole('button', { name: /Add to schedule/ });
    expect(add).toBeDisabled();

    const duration = screen.getByLabelText('Duration') as HTMLSelectElement;
    expect(Array.from(duration.options).map((o) => o.textContent)).toEqual([
      '30 minutes',
      '1 hour',
      '2 hours',
      '4 hours',
      '8 hours',
      'Until end of day',
    ]);
    fireEvent.change(duration, { target: { value: '120' } });

    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(addEntryToChannel).toHaveBeenCalledWith(3, {
        playlist_id: 7,
        start: Date.UTC(2026, 0, 7, 10),
        end: Date.UTC(2026, 0, 7, 12),
      })
    );
    expect(fetchPlaylists).toHaveBeenCalledWith({
      page: { num: 1, size: 10 },
      sortOptions: { key: 'name', direction: 'ascending' },
      search: 'pro',
    });
    await waitFor(() =>
      expect(screen.queryByText(/Starts Wednesday/)).not.toBeInTheDocument()
    );
    expect(await screen.findByText('10:00-12:00')).toBeInTheDocument();
    expect(screen.getByText('Promo')).toBeInTheDocument();
  });

  it('adds from the phone day view', async () => {
    mockViewport(PHONE);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    // Saturday 23:30, the default hour is cut to the end of the day.
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    fireEvent.click(screen.getAllByTestId('calendar-slot')[47]);
    expect(
      screen.getByText(/Starts Saturday, January 10 at 23:30/)
    ).toBeTruthy();
    expect((screen.getByLabelText('Duration') as HTMLSelectElement).value).toBe(
      '30'
    );

    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(addEntryToChannel).toHaveBeenCalledWith(3, {
        playlist_id: 7,
        start: Date.UTC(2026, 0, 10, 23, 30),
        end: Date.UTC(2026, 0, 11, 0),
      })
    );
  });

  it('rejects slots that overlap another entry', async () => {
    getChannelEntries.mockResolvedValue([
      {
        id: 5,
        playlist_id: 2,
        start: Date.UTC(2026, 0, 7, 10),
        end: Date.UTC(2026, 0, 7, 11),
        repeat_weekly_until: null,
      },
    ]);
    mockViewport(DESKTOP);
    renderCalendar();
    expect(await screen.findByText('10:00-11:00')).toBeInTheDocument();

    // Wednesday 09:30 for an hour overlaps the 10:00 entry.
    tapWeekSlot(2, 19);
    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "This time slot overlaps another entry or doesn't fit in the week."
      )
    );
    expect(addEntryToChannel).not.toHaveBeenCalled();
    // The dialog stays open so another duration can be chosen.
    expect(screen.getByText(/Starts Wednesday/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Duration'), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add to schedule/ }));
    await waitFor(() => expect(addEntryToChannel).toHaveBeenCalled());
  });

  it('rejects entries that would end after the visible week', async () => {
    mockViewport(PHONE);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    // Sunday 23:30 until midnight runs past the end of the week.
    fireEvent.click(screen.getAllByTestId('calendar-slot')[47]);
    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "This time slot overlaps another entry or doesn't fit in the week."
      )
    );
    expect(addEntryToChannel).not.toHaveBeenCalled();
  });

  it('adds next to entries on other days', async () => {
    getChannelEntries.mockResolvedValue([
      {
        id: 5,
        playlist_id: 2,
        start: Date.UTC(2026, 0, 7, 10),
        end: Date.UTC(2026, 0, 7, 11),
        repeat_weekly_until: null,
      },
    ]);
    mockViewport(DESKTOP);
    renderCalendar();
    expect(await screen.findByText('10:00-11:00')).toBeInTheDocument();

    // Monday 10:00 does not collide with Wednesday 10:00.
    tapWeekSlot(0, 20);
    await pickPlaylistAndAdd();
    await waitFor(() =>
      expect(addEntryToChannel).toHaveBeenCalledWith(3, {
        playlist_id: 7,
        start: Date.UTC(2026, 0, 5, 10),
        end: Date.UTC(2026, 0, 5, 11),
      })
    );
  });

  it('opens entry details and a localized removal confirmation', async () => {
    getChannelEntries.mockResolvedValue([
      {
        id: 5,
        playlist_id: 2,
        start: Date.UTC(2026, 0, 7, 10),
        end: Date.UTC(2026, 0, 7, 11),
        repeat_weekly_until: null,
      },
    ]);
    mockViewport(PHONE);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    }

    fireEvent.click(await screen.findByText('test'));
    expect(screen.getByText('Calendar entry details')).toBeInTheDocument();
    // Tapping the entry doesn't also start adding a new one.
    expect(screen.queryByText(/Starts Wednesday/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Channel Entry' })
    );
    expect(
      screen.getByText('Are you sure you want to remove entry "10:00-11:00"?')
    ).toBeInTheDocument();
  });

  it('reports failures and keeps the dialog open', async () => {
    addEntryToChannel.mockRejectedValue(new Error('boom'));
    mockViewport(DESKTOP);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    tapWeekSlot(0, 0);
    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Error updating channel entry: Error: boom'
      )
    );
    expect(screen.getByText(/Starts Monday/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Starts Monday/)).not.toBeInTheDocument();
  });
});

describe('durationOptions', () => {
  it('offers the standard durations that fit plus until end of day', () => {
    expect(durationOptions({ dayIndex: 0, hour: 0, minute: 0 })).toEqual([
      30, 60, 120, 240, 480, 1440,
    ]);
    expect(durationOptions({ dayIndex: 0, hour: 22, minute: 30 })).toEqual([
      30, 60, 90,
    ]);
    expect(durationOptions({ dayIndex: 0, hour: 23, minute: 30 })).toEqual([
      30,
    ]);
  });
});
