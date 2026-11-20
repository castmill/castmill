import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { onMount } from 'solid-js';
import {
  COARSE_POINTER_QUERY,
  COMBOBOX_SHEET_QUERY,
} from '@castmill/ui-common';
import { mockMatchMedia } from '@castmill/ui-common/testing';
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
  PlaylistChooser: (props: {
    variant?: string;
    onPlaylistsLoaded?: (playlists: { id: number; name: string }[]) => void;
  }) => {
    onMount(() => props.onPlaylistsLoaded?.([{ id: 2, name: 'test' }]));
    return (
      <div
        data-testid="playlist-chooser"
        data-variant={props.variant ?? 'panel'}
      />
    );
  },
}));
vi.mock('./default-playlist-combobox', () => ({
  DefaultPlaylistComboBox: () => null,
}));
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual<typeof import('@castmill/ui-common')>(
    '@castmill/ui-common'
  );
  return {
    ...actual,
    useToast: () => ({ success: vi.fn(), error: toastError, info: vi.fn() }),
    // Keep the duration picker real; avoid fetching playlists in these tests.
    ComboBox: (props: Parameters<typeof actual.ComboBox>[0]) => {
      if (props.id !== 'calendar-add-entry-playlist') {
        return <actual.ComboBox {...props} />;
      }
      props.fetchItems(1, 10, 'pro');
      const playlist = { id: 7, name: 'Promo' };
      return (
        <button type="button" onClick={() => props.onSelect(playlist)}>
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

const mockViewport = (matching: string[]) => mockMatchMedia(matching);

const DESKTOP = [WIDE_CALENDAR_QUERY];
const TABLET_PORTRAIT: string[] = [];
const TABLET_LANDSCAPE = [WIDE_CALENDAR_QUERY, COARSE_POINTER_QUERY];
const PHONE = [DAY_VIEW_QUERY, COARSE_POINTER_QUERY, COMBOBOX_SHEET_QUERY];

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

// getByRole recomputes jsdom styles for the 336-slot grid after every DOM
// change (~0.35 s locally, far longer on CI), which timed tests out. These
// lookups match the aria-label, aria-labelledby or text content instead.
const ROLE_SELECTORS = {
  button: 'button, [role="button"]',
  option: '[role="option"]',
  dialog: '[role="dialog"]',
  textbox: 'input:not([type]), input[type="text"], input[type="search"]',
} as const;
type Role = keyof typeof ROLE_SELECTORS;

const textOf = (element: Element) => {
  const parts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join(' ');
};

const nameOf = (element: Element) => {
  const label = element.getAttribute('aria-label');
  if (label) return label;
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .map((ref) => (ref ? textOf(ref) : ''))
      .join(' ')
      .trim();
  }
  return textOf(element);
};

const allByRole = (role: Role, root: ParentNode = document) => [
  ...root.querySelectorAll<HTMLElement>(ROLE_SELECTORS[role]),
];

const queryByName = (role: Role, name: string, root?: ParentNode) => {
  const matches = allByRole(role, root).filter((el) => nameOf(el) === name);
  if (matches.length > 1) {
    throw new Error(`Found ${matches.length} ${role}s named "${name}"`);
  }
  return matches[0] ?? null;
};

const byName = (role: Role, name: string, root?: ParentNode) => {
  const element = queryByName(role, name, root);
  if (!element) throw new Error(`Found no ${role} named "${name}"`);
  return element;
};

const findByName = (role: Role, name: string, root?: ParentNode) =>
  waitFor(() => byName(role, name, root));

const findAllByRole = (role: Role) =>
  waitFor(() => {
    const elements = allByRole(role);
    expect(elements.length).toBeGreaterThan(0);
    return elements;
  });

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
    expect(queryByName('button', 'Playlists')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('calendar-slot')).toHaveLength(48 * 7);
  });

  it('renders localized navigation without the old Events button', () => {
    mockViewport(DESKTOP);
    renderCalendar();

    expect(byName('button', 'Previous week')).toBeTruthy();
    expect(byName('button', 'Next week')).toBeTruthy();
    expect(byName('button', 'Today')).toBeTruthy();
    expect(screen.queryByText('Events')).not.toBeInTheDocument();
    expect(screen.queryByText('prev')).not.toBeInTheDocument();
  });

  it('exposes each selectable slot as a named, focusable button', () => {
    mockViewport(TABLET_PORTRAIT);
    renderCalendar();

    const slot = screen.getAllByTestId('calendar-slot')[0];
    expect(slot).toHaveRole('button');
    expect(slot).toHaveAccessibleName(
      'Add to schedule: Starts Monday, January 5 at 00:00'
    );
    expect(slot.dataset.dropData).toBe(
      slot.closest('td')?.getAttribute('data-drop-data')
    );
    slot.focus();
    expect(document.activeElement).toBe(slot);

    fireEvent.click(slot);
    expect(screen.getByText('Starts Monday, January 5 at 00:00')).toBeTruthy();
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

    fireEvent.click(byName('button', 'Next week'));
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START + 7 * DAY_MS);

    fireEvent.click(byName('button', 'Previous week'));
    fireEvent.click(byName('button', 'Previous week'));
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START - 7 * DAY_MS);

    fireEvent.click(byName('button', 'Today'));
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

      const toggle = byName('button', 'Playlists');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('playlist-chooser')).not.toBeVisible();

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('playlist-chooser')).toHaveAttribute(
        'data-variant',
        'strip'
      );

      fireEvent.click(toggle);
      expect(screen.getByTestId('playlist-chooser')).not.toBeVisible();
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
    expect(queryByName('button', 'Playlists')).not.toBeInTheDocument();
    expect(screen.getByTestId('playlist-chooser')).not.toBeVisible();
    await waitFor(() =>
      expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START)
    );

    // Sunday -> Monday of the next week
    fireEvent.click(byName('button', 'Next day'));
    expect(rangeText()).toContain('Monday');
    expect(rangeText()).toContain('12');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START + 7 * DAY_MS);

    // Back to Sunday, then Saturday of the same week
    fireEvent.click(byName('button', 'Previous day'));
    expect(rangeText()).toContain('Sunday');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START);
    fireEvent.click(byName('button', 'Previous day'));
    expect(rangeText()).toContain('Saturday');

    // Monday -> Sunday of the previous week
    for (let i = 0; i < 5; i++) {
      fireEvent.click(byName('button', 'Previous day'));
    }
    expect(rangeText()).toContain('Monday');
    fireEvent.click(byName('button', 'Previous day'));
    expect(rangeText()).toContain('Sunday');
    expect(onWeekChange.mock.lastCall![0]).toBe(WEEK_START - 7 * DAY_MS);

    fireEvent.click(byName('button', 'Today'));
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
      fireEvent.click(byName('button', 'Previous day'));
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

  // The add dialog fades in on the next tick; until its overlay is active it
  // is hidden and not yet interactive.
  const addOverlay = () =>
    [...document.querySelectorAll<HTMLElement>('[class*="modalOverlay"]')]
      .filter((overlay) => /Starts /.test(overlay.textContent ?? ''))
      .at(-1);

  const tapSlot = async (index: number) => {
    fireEvent.click(screen.getAllByTestId('calendar-slot')[index]);
    await waitFor(() => expect(addOverlay()?.className).toMatch(/active/));
  };

  /** Taps the week grid slot for `day` (0 = Monday) and half-hour `slot`. */
  const tapWeekSlot = (day: number, slot: number) => tapSlot(slot * 7 + day);

  const pickPlaylistAndAdd = async () => {
    fireEvent.click(byName('button', 'Playlist', addOverlay()));
    const add = byName('button', 'Add to schedule', addOverlay());
    await waitFor(() => expect(add).not.toBeDisabled());
    fireEvent.click(add);
  };

  it('adds the picked playlist at the tapped slot', async () => {
    mockViewport(TABLET_PORTRAIT);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    // Wednesday 10:00
    await tapWeekSlot(2, 20);
    expect(
      screen.getByText('Starts Wednesday, January 7 at 10:00')
    ).toBeInTheDocument();

    const add = byName('button', 'Add to schedule', addOverlay());
    expect(add).toBeDisabled();

    fireEvent.click(byName('button', 'Duration 1 hour', addOverlay()));
    const durations = await findAllByRole('option');
    expect(durations.map((o) => o.textContent)).toEqual([
      '30 minutes',
      '1 hour',
      '2 hours',
      '4 hours',
      '8 hours',
      'Until end of day',
    ]);
    fireEvent.click(byName('option', '2 hours'));

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
    fireEvent.click(byName('button', 'Previous day'));
    await tapSlot(47);
    expect(
      screen.getByText(/Starts Saturday, January 10 at 23:30/)
    ).toBeTruthy();
    const duration = byName(
      'button',
      'Duration Until end of day',
      addOverlay()
    );
    fireEvent.click(duration);
    const sheet = byName('dialog', 'Duration');
    expect(sheet.closest('[data-combobox-sheet]')).toBeInTheDocument();
    expect(sheet.closest('[data-modal-overlay]')).toBeNull();
    const durations = await findAllByRole('option');
    expect(durations).toHaveLength(1);
    fireEvent.click(durations[0]);
    expect(queryByName('dialog', 'Duration')).not.toBeInTheDocument();
    expect(duration).toHaveFocus();
    expect(
      byName('button', 'Add to schedule', addOverlay())
    ).toBeInTheDocument();

    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(addEntryToChannel).toHaveBeenCalledWith(3, {
        playlist_id: 7,
        start: Date.UTC(2026, 0, 10, 23, 30),
        end: Date.UTC(2026, 0, 11, 0),
      })
    );
  });

  it('changes duration in a mobile sheet without dismissing the schedule dialog', async () => {
    mockViewport(PHONE);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    await tapSlot(26);
    const duration = byName('button', 'Duration 1 hour', addOverlay());
    fireEvent.click(duration);
    expect(byName('dialog', 'Duration')).toBeVisible();
    expect(await findByName('option', '1 hour')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    fireEvent.input(allByRole('textbox', byName('dialog', 'Duration'))[0], {
      target: { value: '2 HOURS' },
    });
    await waitFor(() => expect(allByRole('option')).toHaveLength(1));
    fireEvent.click(byName('option', '2 hours'));
    expect(duration).toHaveTextContent('2 hours');

    fireEvent.click(duration);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(queryByName('dialog', 'Duration')).not.toBeInTheDocument();
    expect(duration).toHaveFocus();
    expect(
      screen.getByText(/Starts Sunday, January 11 at 13:00/)
    ).toBeVisible();

    await pickPlaylistAndAdd();
    await waitFor(() =>
      expect(addEntryToChannel).toHaveBeenCalledWith(3, {
        playlist_id: 7,
        start: Date.UTC(2026, 0, 11, 13),
        end: Date.UTC(2026, 0, 11, 15),
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
    await tapWeekSlot(2, 19);
    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "This time slot overlaps another entry or doesn't fit in the week."
      )
    );
    expect(addEntryToChannel).not.toHaveBeenCalled();
    // The dialog stays open so another duration can be chosen.
    expect(screen.getByText(/Starts Wednesday/)).toBeInTheDocument();

    fireEvent.click(byName('button', 'Duration 1 hour', addOverlay()));
    fireEvent.click(await findByName('option', '30 minutes'));
    fireEvent.click(byName('button', 'Add to schedule', addOverlay()));
    await waitFor(() => expect(addEntryToChannel).toHaveBeenCalled());
  });

  it('rejects entries that would end after the visible week', async () => {
    mockViewport(PHONE);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    // Sunday 23:30 until midnight runs past the end of the week.
    await tapSlot(47);
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
    await tapWeekSlot(0, 20);
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
      fireEvent.click(byName('button', 'Previous day'));
    }

    fireEvent.click(await screen.findByText('test'));
    expect(screen.getByText('Calendar entry details')).toBeInTheDocument();
    // Tapping the entry doesn't also start adding a new one.
    expect(screen.queryByText(/Starts Wednesday/)).not.toBeInTheDocument();

    fireEvent.click(byName('button', 'Remove Channel Entry'));
    expect(
      screen.getByText('Are you sure you want to remove entry "10:00-11:00"?')
    ).toBeInTheDocument();
  });

  it('reports failures and keeps the dialog open', async () => {
    addEntryToChannel.mockRejectedValue(new Error('boom'));
    mockViewport(DESKTOP);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    await tapWeekSlot(0, 0);
    await pickPlaylistAndAdd();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Error updating channel entry: Error: boom'
      )
    );
    expect(screen.getByText(/Starts Monday/)).toBeInTheDocument();

    fireEvent.click(byName('button', 'Cancel', addOverlay()));
    expect(screen.queryByText(/Starts Monday/)).not.toBeInTheDocument();
  });

  it('does not let a disposed dialog close a newly opened dialog after saving', async () => {
    let resolveAdd!: (entry: { id: number }) => void;
    addEntryToChannel.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );
    mockViewport(TABLET_PORTRAIT);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    await tapWeekSlot(0, 0);
    await pickPlaylistAndAdd();
    fireEvent.click(byName('button', 'Cancel', addOverlay()));

    await tapWeekSlot(1, 1);
    expect(screen.getByText('Starts Tuesday, January 6 at 00:30')).toBeTruthy();

    resolveAdd({ id: 99 });
    await waitFor(() =>
      expect(addEntryToChannel).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ playlist_id: 7 })
      )
    );
    expect(
      screen.getByText('Starts Tuesday, January 6 at 00:30')
    ).toBeInTheDocument();
  });

  it('does not let delayed modal cleanup clear a newly opened slot', async () => {
    mockViewport(TABLET_PORTRAIT);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalled());

    await tapWeekSlot(0, 0);
    fireEvent.click(byName('button', 'Cancel', addOverlay()));

    await tapWeekSlot(1, 1);
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(
      screen.getByText('Starts Tuesday, January 6 at 00:30')
    ).toBeInTheDocument();
  });

  it('does not add a late save to a different week', async () => {
    let resolveAdd!: (entry: { id: number }) => void;
    addEntryToChannel.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );
    mockViewport(DESKTOP);
    renderCalendar();
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalledTimes(1));

    await tapWeekSlot(0, 20);
    fireEvent.click(byName('button', 'Duration 1 hour', addOverlay()));
    fireEvent.click(await findByName('option', '30 minutes'));
    await pickPlaylistAndAdd();
    expect(addEntryToChannel).toHaveBeenCalledWith(3, {
      playlist_id: 7,
      start: Date.UTC(2026, 0, 5, 10),
      end: Date.UTC(2026, 0, 5, 10, 30),
    });

    fireEvent.click(byName('button', 'Next week'));
    await waitFor(() => expect(getChannelEntries).toHaveBeenCalledTimes(2));

    resolveAdd({ id: 99 });
    await waitFor(() =>
      expect(screen.queryByText(/Starts Monday/)).not.toBeInTheDocument()
    );
    expect(screen.queryByText('10:00-10:30')).not.toBeInTheDocument();
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
