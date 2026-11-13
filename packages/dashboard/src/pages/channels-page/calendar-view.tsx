import {
  Component,
  createSignal,
  createEffect,
  onCleanup,
  For,
  onMount,
  createMemo,
  Show,
  batch,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';

import { CalendarEntryBox } from './calendar-entry-box';

import styles from './calendar-view.module.scss';
import { CalendarEntry } from './calendar-entry.interface';
import { toZonedTime } from 'date-fns-tz';
import { PlaylistChooser } from './playlist-chooser';
import { baseUrl } from '../../env';
import { store } from '../../store';
import {
  ChannelsService,
  JsonChannel,
  JsonChannelEntry,
} from '../../services/channels.service';
import {
  calendarEntryToTimestamps,
  canMoveCalendarEntry,
  getStartOfWeek,
  getWeekRangeTimestamps,
  timestampsToCalendarEntry,
} from './utils';
import { CalendarCell } from './calendar-cell';
import { DefaultPlaylistComboBox } from './default-playlist-combobox';
import {
  Modal,
  useMediaQuery,
  useToast,
  useWideLayout,
} from '@castmill/ui-common';
import { JsonPlaylist } from '@castmill/player';
import {
  BsCalendarEvent,
  BsChevronDown,
  BsChevronLeft,
  BsChevronRight,
} from 'solid-icons/bs';
import { ChanneEntrylView } from './channel-entry-view';
import { useI18n } from '../../i18n';
import {
  CalendarMarker,
  markerPosition,
  markerStyle,
} from './automation-markers';
import {
  CalendarAddEntry,
  CalendarSlot,
  formatSlotTime,
} from './calendar-add-entry';

/** Viewport query for the wide (side panel + week) layout. */
export const WIDE_CALENDAR_QUERY = '(min-width: 64em)';
/** The calendar layout container must also be this wide (em) to be wide. */
export const WIDE_CALENDAR_MIN_EM = 50;
/** Phones show a single day instead of the week. */
export const DAY_VIEW_QUERY = '(max-width: 40em)';
/** Minimum horizontal travel (px) for a swipe to page the day view. */
export const SWIPE_MIN_PX = 50;

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;

const isRtl = (el: Element) =>
  el.closest('[dir]')?.getAttribute('dir')?.toLowerCase() === 'rtl';

export interface DropTargetData {
  dayIndex: number;
  hour: number;
  minute: number;
}

interface CalendarViewProps {
  channel: JsonChannel;
  timeZone: string;
  /** Optional point-in-time markers (e.g. automation firings). */
  markers?: CalendarMarker[];
  /** Called with the visible week range (epoch ms) whenever it changes. */
  onWeekChange?: (start: number, end: number) => void;
}

export const CalendarView: Component<CalendarViewProps> = (props) => {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [showEntryModal, setShowEntryModal] = createSignal<CalendarEntry>();
  const [pendingSlot, setPendingSlot] = createSignal<CalendarSlot>();

  // Start date for a “week”
  const [startDate, setStartDate] = createSignal(
    getStartOfWeek(toZonedTime(new Date(), props.timeZone))
  );

  // Responsive layout: wide (desktop) keeps the side panel and week grid,
  // narrow (tablets, touch) stacks a collapsible playlist strip above the
  // week grid, and phones page through single days.
  const { ref: setLayoutRef, wide: wideViewport } = useWideLayout({
    query: WIDE_CALENDAR_QUERY,
    minEm: WIDE_CALENDAR_MIN_EM,
  });
  const coarsePointer = useMediaQuery('(pointer: coarse)', false);
  const dayView = useMediaQuery(DAY_VIEW_QUERY, false);
  const wide = () => wideViewport() && !coarsePointer() && !dayView();
  const [chooserOpen, setChooserOpen] = createSignal(false);

  // Day shown by the phone day view (0 = Monday of the visible week).
  const [selectedDay, setSelectedDay] = createSignal(
    weekdayIndex(toZonedTime(new Date(), props.timeZone))
  );
  const visibleDays = createMemo(() =>
    dayView() ? [selectedDay()] : WEEK_DAYS
  );
  const visibleRange = createMemo(() => {
    const days = visibleDays();
    return { first: days[0], last: days[days.length - 1] };
  });

  const [hoveredCells, setHoveredCells] = createSignal<string[]>([]);
  const hoveredSet = createMemo(() => new Set(hoveredCells()));

  let channelsService: ChannelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );

  function calculateSlots(entry: CalendarEntry): number {
    const startMinutes = entry.startHour * 60 + entry.startMinute;
    const endMinutes = entry.endHour * 60 + entry.endMinute;
    const totalMinutes = endMinutes - startMinutes;
    return Math.ceil(totalMinutes / 30);
  }

  // Calculate the current day's index relative to startDate
  const currentDayIndex = createMemo(() => {
    const today = toZonedTime(new Date(), props.timeZone);
    const start = startDate();
    const diffMs = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const index = diffDays >= 0 && diffDays < 7 ? diffDays : -1; // -1 if today is not in the current week
    return index;
  });

  let lastDropData: any;

  const handleDragOverCell = (
    entry: CalendarEntry,
    ghostPosition?: { x: number; y: number }
  ) => {
    if (ghostPosition) {
      const { height, width } = getCellDimensions();

      const el = document.elementFromPoint(
        ghostPosition.x + width / 2,
        ghostPosition.y + height / 2
      ) as HTMLTableCellElement;

      lastDropData = el?.dataset?.dropData
        ? JSON.parse(el.dataset.dropData!)
        : null;
    }

    if (lastDropData) {
      const { dayIndex, hour, minute } = lastDropData;
      const cellsToHighlight: string[] = [];
      const startSlot = slotFromTime(hour, minute);
      const slots = calculateSlots(entry); // Duration in 30-minute slots
      const endSlot = Math.min(startSlot + slots, 48); // Cap at 24 hours

      // Highlight across all days in numDays, starting from drop target's day and time
      for (let d = 0; d < entry.numDays; d++) {
        const currentDay = dayIndex + d;
        if (currentDay > visibleRange().last) break; // Don’t exceed calendar grid
        for (let slot = startSlot; slot < endSlot; slot++) {
          if (slot < 48) {
            // Ensure within day bounds
            const key = `day-${currentDay}-slot-${slot}`;
            cellsToHighlight.push(key);
          }
        }
      }
      setHoveredCells(cellsToHighlight);
    } else {
      setHoveredCells([]);
    }
  };

  function slotFromTime(hour: number, minute: number): number {
    return hour * 2 + (minute === 30 ? 1 : 0);
  }

  const computeNewEntry = (
    entry: CalendarEntry,
    dropTargetData: { dayIndex: number; hour: number; minute: number }
  ): CalendarEntry => {
    const { dayIndex, hour, minute } = dropTargetData;

    // Calculate duration in minutes
    const durationMinutes =
      entry.endHour * 60 +
      entry.endMinute -
      (entry.startHour * 60 + entry.startMinute);

    // New start time
    const startHour = hour;
    const startMinute = minute;

    // Compute new end time
    let endMinutes = startHour * 60 + startMinute + durationMinutes;
    endMinutes = Math.min(endMinutes, 1440);
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;

    // Update title
    const title = `${startHour}:${startMinute.toString().padStart(2, '0')}-${endHour}:${endMinute.toString().padStart(2, '0')}`;

    return {
      numDays: entry.numDays,
      id: entry.id,
      playlist: entry.playlist,
      dayIndex,
      startHour,
      startMinute,
      endHour,
      endMinute,
      title,
      weekly: entry.weekly,
    };
  };

  function doEntriesOverlap(
    entryA: CalendarEntry,
    entryB: CalendarEntry
  ): boolean {
    // Calculate day ranges
    const aStartDay = entryA.dayIndex;
    const aEndDay = aStartDay + entryA.numDays - 1;

    const bStartDay = entryB.dayIndex;
    const bEndDay = bStartDay + entryB.numDays - 1;

    // Check if days overlap
    const overlapStartDay = Math.max(aStartDay, bStartDay);
    const overlapEndDay = Math.min(aEndDay, bEndDay);
    if (overlapStartDay > overlapEndDay) {
      return false; // No day overlap
    }

    // Convert times to minutes for time overlap check
    const aStartTime = entryA.startHour * 60 + entryA.startMinute;
    const aEndTime = entryA.endHour * 60 + entryA.endMinute;
    const bStartTime = entryB.startHour * 60 + entryB.startMinute;
    const bEndTime = entryB.endHour * 60 + entryB.endMinute;

    // Check if time ranges overlap
    return aStartTime < bEndTime && bStartTime < aEndTime;
  }

  const [entries, setEntries] = createStore<CalendarEntry[]>([]);

  /**
   * Whether `candidate` fits in the visible week without overlapping any
   * other entry (`ignoreId` is the entry being moved, if any).
   */
  const isValidPlacement = (candidate: CalendarEntry, ignoreId?: number) => {
    if (
      !canMoveCalendarEntry(
        candidate,
        candidate.dayIndex,
        candidate.startHour,
        candidate.startMinute
      )
    ) {
      return false;
    }

    try {
      calendarEntryToTimestamps(candidate, startDate(), props.timeZone);
    } catch {
      return false;
    }

    return !entries.some(
      (existing) =>
        existing.id !== ignoreId && doEntriesOverlap(candidate, existing)
    );
  };

  const createEntry = async (newEntry: CalendarEntry) => {
    const opts = calendarEntryToTimestamps(
      newEntry,
      startDate(),
      props.timeZone
    );
    const addedEntry = await channelsService.addEntryToChannel(
      props.channel.id,
      {
        playlist_id: newEntry.playlist.id,
        ...opts,
      }
    );

    newEntry.id = addedEntry.id;
    setEntries([...entries, newEntry]);
  };

  /** Tap-to-add: schedules `playlist` at `slot` for `durationMinutes`. */
  const addEntryAt = async (
    slot: CalendarSlot,
    playlist: JsonPlaylist,
    durationMinutes: number
  ): Promise<boolean> => {
    const candidate = computeNewEntry(
      {
        id: 0,
        title: '',
        isNewEntry: true,
        playlist: { id: playlist.id, name: playlist.name },
        numDays: 1,
        dayIndex: slot.dayIndex,
        startHour: 0,
        startMinute: 0,
        endHour: Math.floor(durationMinutes / 60),
        endMinute: durationMinutes % 60,
        weekly: false,
      },
      slot
    );

    if (!isValidPlacement(candidate)) {
      toast.error(t('channels.calendar.slotUnavailable'));
      return false;
    }

    try {
      await createEntry(candidate);
      return true;
    } catch (error) {
      toast.error(
        t('channels.errors.updateChannelEntry', { error: String(error) })
      );
      return false;
    }
  };

  createEffect(() => {
    const range = getWeekRangeTimestamps(startDate(), props.timeZone);
    props.onWeekChange?.(range.start, range.end);
  });

  const visibleMarkers = createMemo(() =>
    (props.markers ?? []).flatMap((marker) => {
      const position = markerPosition(marker.time, startDate(), props.timeZone);
      const column = position ? visibleDays().indexOf(position.dayIndex) : -1;
      return position && column >= 0 ? [{ marker, position, column }] : [];
    })
  );

  const visibleEntries = createMemo(() =>
    entries.filter(
      (entry) =>
        entry.dayIndex <= visibleRange().last &&
        entry.dayIndex + entry.numDays - 1 >= visibleRange().first
    )
  );

  createEffect(async () => {
    const range = getWeekRangeTimestamps(startDate(), props.timeZone);

    // Fetch entries
    const result = await channelsService.getChannelEntries(
      props.channel.id,
      range.start,
      range.end
    );

    if (result) {
      setEntries(
        result.map((entry: JsonChannelEntry) =>
          timestampsToCalendarEntry(entry, props.timeZone)
        )
      );
    }
  });

  // Generate half-hour increments for 24h => 48 slots
  const timeSlots = createMemo(() => {
    const arr = [];
    for (let h = 0; h < 24; h++) {
      arr.push({
        hour: h,
        minute: 0,
        label: `${h.toString().padStart(2, '0')}:00`,
      });
      arr.push({ hour: h, minute: 30, label: '' });
    }
    return arr;
  });

  /** Zoned date of the given day of the visible week. */
  const dayDate = (dayIndex: number) => {
    const date = new Date(startDate());
    date.setDate(date.getDate() + dayIndex);
    return date;
  };

  // Localized date-range label (a single day in the day view)
  const dateRangeText = () => {
    if (dayView()) {
      return dayDate(selectedDay()).toLocaleDateString(locale(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    const format: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return `${dayDate(0).toLocaleDateString(locale(), format)} – ${dayDate(
      6
    ).toLocaleDateString(locale(), format)}`;
  };

  // Navigation
  const shiftWeek = (days: number) => {
    const curr = new Date(startDate());
    curr.setDate(curr.getDate() + days);
    setStartDate(getStartOfWeek(curr));
  };
  const goPrev = () => {
    if (!dayView()) return shiftWeek(-7);
    if (selectedDay() > 0) return setSelectedDay(selectedDay() - 1);
    batch(() => {
      shiftWeek(-7);
      setSelectedDay(6);
    });
  };
  const goNext = () => {
    if (!dayView()) return shiftWeek(7);
    if (selectedDay() < 6) return setSelectedDay(selectedDay() + 1);
    batch(() => {
      shiftWeek(7);
      setSelectedDay(0);
    });
  };
  const goToday = () => {
    const today = toZonedTime(new Date(), props.timeZone);
    batch(() => {
      setStartDate(getStartOfWeek(today));
      setSelectedDay(weekdayIndex(today));
    });
  };

  // Swipe paging for the day view
  let touchStart: { x: number; y: number } | undefined;
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY } : undefined;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart;
    const touch = e.changedTouches[0];
    touchStart = undefined;
    if (!dayView() || !start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) {
      return;
    }
    // Swiping towards the inline start reveals the next day.
    const forward = isRtl(e.currentTarget as Element) ? dx > 0 : dx < 0;
    if (forward) goNext();
    else goPrev();
  };

  // DnD setup for each cell in the body table
  const cellRefs = new Map<string, HTMLTableCellElement>();

  const canDrop = ({ source }: { source: any }) => {
    const entryBeingDragged = source.data.entry as CalendarEntry | undefined;
    if (!entryBeingDragged) return false;

    if (!lastDropData) {
      setHoveredCells([]);
      return false;
    }

    if (
      !canMoveCalendarEntry(
        entryBeingDragged,
        lastDropData.dayIndex,
        lastDropData.hour,
        lastDropData.minute
      ) ||
      !isValidPlacement(
        computeNewEntry(entryBeingDragged, lastDropData),
        entryBeingDragged.id
      )
    ) {
      setHoveredCells([]);
      return false;
    }
    return true; // Drop allowed
  };

  const onDrop =
    (el: HTMLElement) =>
    async ({ source }: { source: any }) => {
      el.style.backgroundColor = '';
      setHoveredCells([]);

      if (lastDropData) {
        const { dayIndex, hour, minute } = lastDropData;
        lastDropData = undefined;
        const { entry } = source.data as { entry?: CalendarEntry };

        if (!entry || !canMoveCalendarEntry(entry, dayIndex, hour, minute)) {
          return;
        }

        try {
          const newEntry = computeNewEntry(entry, { dayIndex, hour, minute });

          if (entry.isNewEntry) {
            await createEntry(newEntry);
          } else {
            const opts = calendarEntryToTimestamps(
              newEntry,
              startDate(),
              props.timeZone
            );
            await channelsService.updateChannelEntry(
              props.channel.id,
              entry.id,
              opts
            );
            setEntries((e) => e.id === entry.id, {
              dayIndex: newEntry.dayIndex,
              title: newEntry.title,
              startHour: newEntry.startHour,
              startMinute: newEntry.startMinute,
              endHour: newEntry.endHour,
              endMinute: newEntry.endMinute,
            });
          }
        } catch (error) {
          toast.error(
            t('channels.errors.updateChannelEntry', { error: String(error) })
          );
        }
      }
    };

  // --- AUTO-SCROLL LOGIC ---
  let scrollContainer: HTMLDivElement | undefined;
  onMount(() => {
    if (scrollContainer) {
      const cleanupAutoScroll = autoScrollForElements({
        element: scrollContainer,
        // Optionally, you can provide additional configuration:
        // canScroll: ({ source }) => source.data.type === 'calendar-entry',
        // getAllowedAxis: () => 'vertical',
        // getConfiguration: () => ({ maxScrollSpeed: 'standard' }),
      });
      onCleanup(() => cleanupAutoScroll());
    }
  });

  // **New Scroll Logic**
  onMount(() => {
    // Initial scroll after DOM is rendered
    setTimeout(() => {
      if (scrollContainer && currentTimePosition() > 0) {
        const cellHeight = getCellDimensions().height;
        if (cellHeight > 0) {
          const totalMinutes = currentTimePosition();
          const minutesPerSlot = 30;
          const slotIndex = Math.floor(totalMinutes / minutesPerSlot);
          const scrollPosition = slotIndex * cellHeight;
          scrollContainer.scrollTo({
            top: scrollPosition,
            behavior: 'smooth',
          });
        }
      }
    }, 0); // Delay to ensure DOM rendering
  });

  // Time bar state
  const [currentTimePosition, setCurrentTimePosition] = createSignal<number>(0);

  // Update current time bar position every second
  createEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const zonedNow = toZonedTime(now, props.timeZone);
      const hours = zonedNow.getHours();
      const minutes = zonedNow.getMinutes();
      const seconds = zonedNow.getSeconds();
      const totalMinutes = hours * 60 + minutes + seconds / 60;
      setCurrentTimePosition(totalMinutes);
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 60_000); // Update every 60 seconds
    onCleanup(() => clearInterval(interval));
  });

  const onDelete = async (id: number) => {
    await channelsService.removeEntryFromChannel(props.channel.id, id);
    setEntries(entries.filter((entry) => entry.id !== id));
  };

  const onInfo = (entry: CalendarEntry) => {
    setShowEntryModal(entry);
  };

  const closeEntryModal = () => {
    setShowEntryModal(undefined);
  };

  const onResizeComplete = async (updated: CalendarEntry) => {
    try {
      const update = calendarEntryToTimestamps(
        updated,
        startDate(),
        props.timeZone
      );
      await channelsService.updateChannelEntry(
        props.channel.id,
        updated.id,
        update
      );

      setEntries((all) => all.map((x) => (x.id === updated.id ? updated : x)));
    } catch (error) {
      toast.error(
        t('channels.errors.updateChannelEntry', { error: String(error) })
      );
    }
  };

  const getCellDimensions = () => {
    const measureCell = cellRefs.get(`day-${visibleRange().first}-slot-1`);
    if (!measureCell) {
      return { width: 0, height: 0 };
    }

    const cellRect = measureCell.getBoundingClientRect();

    return { width: cellRect.width, height: cellRect.height };
  };

  const getTimeBarTop = () => {
    const minutesPerDay = 1440; // 24 hours * 60 minutes
    const slotsPerDay = 48; // 30-minute slots
    const top =
      (currentTimePosition() / minutesPerDay) *
      slotsPerDay *
      getCellDimensions().height;
    return `${top}px`;
  };

  const currentTimeLabel = () => {
    const totalMinutes = Math.floor(currentTimePosition());
    return formatSlotTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  const prevLabel = () =>
    dayView()
      ? t('channels.calendar.previousDay')
      : t('channels.calendar.previousWeek');
  const nextLabel = () =>
    dayView()
      ? t('channels.calendar.nextDay')
      : t('channels.calendar.nextWeek');

  return (
    <>
      <Show when={showEntryModal()}>
        <Modal
          title={showEntryModal()!.playlist.name}
          description={t('channels.calendarEntryDetails')}
          onClose={closeEntryModal}
        >
          <ChanneEntrylView
            entry={showEntryModal()!}
            onClose={() => setShowEntryModal()}
            onSubmit={async ({ weekly }: Partial<CalendarEntry>) => {
              try {
                const result = await channelsService.updateChannelEntry(
                  props.channel.id,
                  showEntryModal()!.id,
                  {
                    repeat_weekly_until: weekly ? new Date('9999-12-31') : null,
                  }
                );

                // Must update the entry in the store
                setEntries((all) =>
                  all.map((x) =>
                    x.id === showEntryModal()!.id
                      ? {
                          ...showEntryModal()!,
                          weekly: weekly ?? showEntryModal()!.weekly,
                        }
                      : x
                  )
                );

                setShowEntryModal();
                toast.success(t('channels.success.updateChannelEntry'));
              } catch (error) {
                toast.error(
                  t('channels.errors.updateChannelEntry', {
                    error: String(error),
                  })
                );
              }
            }}
          />
        </Modal>
      </Show>
      <Show when={pendingSlot()}>
        {(slot) => (
          <CalendarAddEntry
            slot={slot()}
            dateLabel={dayDate(slot().dayIndex).toLocaleDateString(locale(), {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
            channelsService={channelsService}
            onAdd={(playlist, duration) =>
              addEntryAt(slot(), playlist, duration)
            }
            onClose={() => setPendingSlot(undefined)}
          />
        )}
      </Show>
      <div
        ref={setLayoutRef}
        class={styles['calendar-layout']}
        classList={{
          [styles.narrow]: !wide(),
          [styles['day-view']]: dayView(),
        }}
        data-layout={wide() ? 'wide' : dayView() ? 'day' : 'narrow'}
      >
        <div class={styles['left-panel']}>
          <DefaultPlaylistComboBox channel={props.channel} />
          <Show
            when={wide()}
            fallback={
              <>
                <Show when={!dayView()}>
                  <button
                    type="button"
                    class={styles['chooser-toggle']}
                    aria-expanded={chooserOpen()}
                    aria-controls={`channel-${props.channel.id}-playlists`}
                    onClick={() => setChooserOpen(!chooserOpen())}
                  >
                    <span>{t('sidebar.playlists')}</span>
                    <BsChevronDown
                      class={styles['chooser-toggle-icon']}
                      aria-hidden="true"
                    />
                  </button>
                  <Show when={chooserOpen()}>
                    <div
                      id={`channel-${props.channel.id}-playlists`}
                      class={styles['chooser-strip']}
                    >
                      <PlaylistChooser
                        variant="strip"
                        onDragOverCell={handleDragOverCell}
                      />
                    </div>
                  </Show>
                </Show>
                <p class={styles['tap-hint']}>
                  {t('channels.calendar.tapToAdd')}
                </p>
              </>
            }
          >
            <PlaylistChooser onDragOverCell={handleDragOverCell} />
          </Show>
        </div>
        <div class={styles['calendar-wrapper']}>
          {/* Top bar: nav + range */}
          <div class={styles['calendar-header']}>
            <div class={styles.nav}>
              <button
                type="button"
                class={styles['nav-button']}
                onClick={goPrev}
                aria-label={prevLabel()}
                title={prevLabel()}
              >
                <BsChevronLeft class={styles['nav-icon']} aria-hidden="true" />
              </button>
              <button
                type="button"
                class={styles['nav-button']}
                onClick={goToday}
                aria-label={t('channels.calendar.today')}
                title={t('channels.calendar.today')}
              >
                <BsCalendarEvent aria-hidden="true" />
                <span class={styles['nav-label']}>
                  {t('channels.calendar.today')}
                </span>
              </button>
              <button
                type="button"
                class={styles['nav-button']}
                onClick={goNext}
                aria-label={nextLabel()}
                title={nextLabel()}
              >
                <BsChevronRight class={styles['nav-icon']} aria-hidden="true" />
              </button>
            </div>
            <div
              class={styles['range-label']}
              aria-live="polite"
              data-testid="calendar-range"
            >
              {dateRangeText()}
            </div>
          </div>

          {/* Pinned header table */}
          <div class={styles['header-table-container']}>
            <table class={styles['header-table']}>
              <colgroup>
                <col class={styles['time-col']} />
                <For each={visibleDays()}>{() => <col />}</For>
              </colgroup>
              <thead>
                <tr>
                  <th class={styles['header-time-col']}>
                    <span class={styles['time-zone']}>{props.timeZone}</span>
                  </th>
                  <For each={visibleDays()}>
                    {(dayIndex) => (
                      <th data-testid="calendar-day-header">
                        <span class={styles['day-name']}>
                          {dayDate(dayIndex).toLocaleDateString(locale(), {
                            weekday: 'short',
                          })}
                        </span>
                        <span class={styles['day-date']}>
                          {dayDate(dayIndex).toLocaleDateString(locale(), {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
            </table>
          </div>

          {/* Body table (scrollable) */}
          <div
            class={styles['body-table-container']}
            ref={(el) => (scrollContainer = el)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            data-testid="calendar-body"
          >
            <table class={styles['body-table']}>
              <colgroup>
                <col class={styles['time-col']} />
                <For each={visibleDays()}>{() => <col />}</For>
              </colgroup>
              <tbody>
                <For each={timeSlots()}>
                  {(slot, slotIndex) => (
                    <tr>
                      {/* Time column cell */}
                      <td class={styles['body-time-col']}>
                        {/* Show label only on top-of-hour rows */}
                        {slot.minute === 0 ? slot.label : ''}
                      </td>

                      {/* Visible day cells (7, or 1 in the day view) */}
                      <For each={visibleDays()}>
                        {(dayIndex) => {
                          const key = `day-${dayIndex}-slot-${slotIndex()}`;
                          const dropData = {
                            dayIndex,
                            hour: Math.floor(slotIndex() / 2),
                            minute: slotIndex() % 2 === 0 ? 0 : 30,
                          };

                          return (
                            <CalendarCell
                              key={key}
                              dropData={dropData}
                              isHovered={hoveredSet().has(key)}
                              isCurrentDay={dayIndex === currentDayIndex()}
                              cellRefs={cellRefs}
                              canDrop={canDrop}
                              onDrop={onDrop}
                              onSelect={setPendingSlot}
                            />
                          );
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            {/* The event layer => absolutely positioned items */}
            <div class={styles['event-layer']}>
              <For each={visibleEntries()}>
                {(ev) => (
                  <CalendarEntryBox
                    entry={ev}
                    cellGrid={cellRefs}
                    visibleDays={visibleRange()}
                    onResizeComplete={onResizeComplete}
                    onDelete={onDelete}
                    onInfo={onInfo}
                    onDragOverCell={handleDragOverCell}
                    hasOverlap={(candidate) =>
                      entries.some(
                        (x) =>
                          x.id !== candidate.id &&
                          doEntriesOverlap(x, candidate)
                      )
                    }
                  />
                )}
              </For>
            </div>

            <Show when={visibleMarkers().length > 0}>
              <div class={styles['marker-layer']}>
                <For each={visibleMarkers()}>
                  {(item) => (
                    <div
                      class={styles['automation-marker']}
                      style={markerStyle(
                        item.position,
                        getCellDimensions().height,
                        item.column,
                        visibleDays().length
                      )}
                      title={item.marker.label}
                      aria-label={item.marker.label}
                      role="img"
                      data-testid="automation-marker"
                    />
                  )}
                </For>
              </div>
            </Show>

            <div class={styles['time-bar']} style={{ top: getTimeBarTop() }}>
              <div class={styles['time-bar-label']}>{currentTimeLabel()}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
