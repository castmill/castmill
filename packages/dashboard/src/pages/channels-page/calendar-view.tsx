import {
  Component,
  createSignal,
  createEffect,
  onCleanup,
  For,
  onMount,
  createMemo,
  Show,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';

import { CalendarEntryBox } from './calendar-entry-box';

import styles from './calendar-view.module.scss';
import { CalendarEntry } from './calendar-entry.interface';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { PlaylistChooser } from './playlist-chooser';
import { baseUrl } from '../../env';
import { store } from '../../store';
import {
  ChannelsService,
  JsonChannel,
  JsonChannelEntry,
} from '../../services/channels.service';
import { timestampsToCalendarEntry } from './utils';
import { CalendarCell } from './calendar-cell';
import { DefaultPlaylistComboBox } from './default-playlist-combobox';
import { Modal, useToast } from '@castmill/ui-common';
import { ChanneEntrylView } from './channel-entry-view';
import { useI18n } from '../../i18n';

export interface DropTargetData {
  dayIndex: number;
  hour: number;
  minute: number;
}

interface CalendarViewProps {
  channel: JsonChannel;
  timeZone: string;
}

export const CalendarView: Component<CalendarViewProps> = (props) => {
  const { t } = useI18n();
  const [showEntryModal, setShowEntryModal] = createSignal<CalendarEntry>();

  // Start date for a “week”
  const [startDate, setStartDate] = createSignal(getStartOfWeek(new Date()));

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

  // Weeks starts on Monday at 00:00
  function getStartOfWeek(date: Date): Date {
    // Make a copy so we don't modify the original date
    const result = new Date(date);
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    const dayOfWeek = (result.getDay() - 1) % 7; // 0-indexed

    // Subtract `dayOfWeek` days from the current date
    result.setDate(result.getDate() - dayOfWeek);
    result.setHours(0, 0, 0, 0); // Start of the day
    return result;
  }

  function getEndOfWeek(date: Date): Date {
    const start = getStartOfWeek(date);
    const result = new Date(start);
    result.setDate(result.getDate() + 6); // 6 more days
    result.setHours(23, 59, 59, 999); // End of the day
    return result;
  }

  function getDateByDayIndex(startOfWeek: Date, dayIndex: number): Date {
    // Create a fresh copy of startOfWeek
    const date = new Date(startOfWeek);

    // Add dayIndex days to the start date
    date.setDate(date.getDate() + dayIndex);

    return date;
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
      const daysToShow = 7; // Match the calendar's visible days
      const startSlot = slotFromTime(hour, minute);
      const slots = calculateSlots(entry); // Duration in 30-minute slots
      const endSlot = Math.min(startSlot + slots, 48); // Cap at 24 hours

      // Highlight across all days in numDays, starting from drop target's day and time
      for (let d = 0; d < entry.numDays; d++) {
        const currentDay = dayIndex + d;
        if (currentDay >= daysToShow) break; // Don’t exceed calendar grid
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
    // Clamp end time to 23:59 (1439 minutes)
    if (endMinutes >= 1440) {
      endMinutes = 1439; // 23:59
    }
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

  // Show 7 days
  const daysToShow = 7;
  const [entries, setEntries] = createStore<CalendarEntry[]>([]);

  createEffect(async () => {
    // Fetch entries
    const result = await channelsService.getChannelEntries(
      props.channel.id,
      startDate().getTime(),
      getEndOfWeek(startDate()).getTime()
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

  // Simple date-range label
  const dateRangeText = () => {
    const s = startDate();
    const e = new Date(s);
    e.setDate(e.getDate() + daysToShow - 1);
    return `${s.toLocaleDateString()} - ${e.toLocaleDateString()}`;
  };

  // Navigation
  const goPrevWeek = () => {
    const curr = new Date(startDate());
    curr.setDate(curr.getDate() - 7);
    setStartDate(getStartOfWeek(curr));
  };
  const goNextWeek = () => {
    const curr = new Date(startDate());
    curr.setDate(curr.getDate() + 7);
    setStartDate(getStartOfWeek(curr));
  };
  const goToday = () => {
    setStartDate(getStartOfWeek(new Date()));
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

    const newEntry = computeNewEntry(entryBeingDragged, lastDropData);

    // Check for overlaps with existing entries
    for (const existingEntry of entries) {
      if (existingEntry.id === entryBeingDragged.id) {
        continue; // Skip the dragged entry
      }

      if (doEntriesOverlap(newEntry, existingEntry)) {
        setHoveredCells([]);
        return false; // Overlap detected
      }
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
        const { entry } = source.data as { entry?: CalendarEntry };

        if (!entry) {
          return;
        }

        const newEntry = computeNewEntry(entry, { dayIndex, hour, minute });
        const start = getDateByDayIndex(startDate(), dayIndex);
        const end = getDateByDayIndex(
          startDate(),
          dayIndex + entry.numDays - 1
        );

        const opts = {
          start: fromZonedTime(
            new Date(
              start.getFullYear(),
              start.getMonth(),
              start.getDate(),
              newEntry.startHour,
              newEntry.startMinute
            ),
            props.timeZone
          ).getTime(),
          end: fromZonedTime(
            new Date(
              end.getFullYear(),
              end.getMonth(),
              end.getDate(),
              newEntry.endHour,
              newEntry.endMinute
            ),
            props.timeZone
          ).getTime(),
        };

        // Hackish
        if (entry.isNewEntry) {
          // Add the new entry
          const addedEntry = await channelsService.addEntryToChannel(
            props.channel.id,
            {
              playlist_id: newEntry.playlist.id,
              ...opts,
            }
          );

          newEntry.id = addedEntry.id;

          setEntries([...entries, newEntry]);
        } else {
          await channelsService.updateChannelEntry(
            props.channel.id,
            entry.id,
            opts
          );
          // Update the store
          setEntries((e) => e.id === entry.id, {
            dayIndex: newEntry.dayIndex,
            title: newEntry.title,
            startHour: newEntry.startHour,
            startMinute: newEntry.startMinute,
            endHour: newEntry.endHour,
            endMinute: newEntry.endMinute,
          });
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
    // We must convert the entry to UTC before sending it to the server
    const start = getDateByDayIndex(startDate(), updated.dayIndex);
    const end = getDateByDayIndex(
      startDate(),
      updated.dayIndex + updated.numDays - 1
    );

    await channelsService.updateChannelEntry(props.channel.id, updated.id, {
      start: fromZonedTime(
        new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
          updated.startHour,
          updated.startMinute
        ),
        props.timeZone
      ).getTime(),
      end: fromZonedTime(
        new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate(),
          updated.endHour,
          updated.endMinute
        ),
        props.timeZone
      ).getTime(),
    });

    setEntries((all) => all.map((x) => (x.id === updated.id ? updated : x)));
  };

  const getCellDimensions = () => {
    const measureCell = cellRefs.get('day-0-slot-1');
    if (!measureCell) {
      return { width: 0, height: 0 };
    }

    const cellRect = measureCell.getBoundingClientRect();

    return { width: cellRect.width, height: cellRect.height };
  };

  const getTimeBarStyle = () => {
    const totalMinutes = currentTimePosition();
    const minutesPerDay = 1440; // 24 hours * 60 minutes

    const cellDims = getCellDimensions();

    const cellHeight = cellDims.height;
    const slotsPerDay = 48; // 30-minute slots

    const top = (totalMinutes / minutesPerDay) * slotsPerDay * cellHeight;

    return {
      position: 'absolute',
      top: `${top}px`,
      left: '10%', // Align with time column (10% width as per CSS)
      width: '90%', // Span across all day columns (90% width as per CSS)
      height: '2px', // Thin line
      background: '#007bff', // Blue line (match your image)
      'z-index': 10, // Above other elements
    };
  };

  const dayLabels = createMemo(() => {
    const labels = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate());
      date.setDate(date.getDate() + i);
      labels.push(date.toDateString());
    }
    return labels;
  });

  return (
    <>
      <Show when={showEntryModal()}>
        <Modal
          title={showEntryModal()?.playlist.name!}
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
                      ? { ...showEntryModal()!, weekly }
                      : x
                  )
                );

                setShowEntryModal();
                toast.success('Channel entry updated successfully');
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
      <div class={styles['left-panel']}>
        <DefaultPlaylistComboBox channel={props.channel} />
        <PlaylistChooser onDragOverCell={handleDragOverCell} />
      </div>
      <div class={styles['calendar-wrapper']}>
        {/* Top bar: nav + range */}
        <div class={styles['calendar-header']}>
          <div>
            <button onClick={goPrevWeek}>prev</button>
            <button onClick={goToday}>today</button>
            <button onClick={goNextWeek}>next</button>
          </div>
          <div style="font-size: 18px; font-weight: bold;">
            {dateRangeText()}
          </div>
          <button>Events</button>
        </div>

        {/* Pinned header table */}
        <div class={styles['header-table-container']}>
          <table class={styles['header-table']}>
            <thead>
              <tr>
                {/* Time column: 10% */}
                <th class={styles['header-time-col']}>{props.timeZone}</th>
                {/* 7 day columns => share 90% */}
                <For each={dayLabels()}>{(label) => <th>{label}</th>}</For>
              </tr>
            </thead>
          </table>
        </div>

        {/* Body table (scrollable) */}
        <div
          class={styles['body-table-container']}
          ref={(el) => (scrollContainer = el)}
        >
          <table class={styles['body-table']}>
            <tbody>
              <For each={timeSlots()}>
                {(slot, slotIndex) => (
                  <tr>
                    {/* Time column cell */}
                    <td class={styles['body-time-col']}>
                      {/* Show label only on top-of-hour rows */}
                      {slot.minute === 0 ? slot.label : ''}
                    </td>

                    {/* 7 day cells */}
                    <For each={[0, 1, 2, 3, 4, 5, 6]}>
                      {(_, dayIndex) => {
                        const key = `day-${dayIndex()}-slot-${slotIndex()}`;
                        const dropData = {
                          dayIndex: dayIndex(),
                          hour: Math.floor(slotIndex() / 2),
                          minute: slotIndex() % 2 === 0 ? 0 : 30,
                        };

                        return (
                          <CalendarCell
                            key={key}
                            dropData={dropData}
                            isHovered={hoveredSet().has(key)}
                            isCurrentDay={dayIndex() === currentDayIndex()}
                            cellRefs={cellRefs}
                            canDrop={canDrop}
                            onDrop={onDrop}
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
            <For each={entries}>
              {(ev) => (
                // In CalendarView, inside the event-layer For loop
                <CalendarEntryBox
                  entry={ev}
                  cellGrid={cellRefs}
                  onResizeComplete={onResizeComplete}
                  onDelete={onDelete}
                  onInfo={onInfo}
                  onDragOverCell={handleDragOverCell}
                  hasOverlap={(candidate) =>
                    entries.some(
                      (x) =>
                        x.id !== candidate.id && doEntriesOverlap(x, candidate)
                    )
                  }
                />
              )}
            </For>
          </div>

          <div style={getTimeBarStyle()}>
            <div
              style={{
                position: 'absolute',
                left: '-4em',
                top: '-0.5em',
                width: '4em',
                height: '1em',
                background: '#007bff',
                'border-radius': '30%',
                'font-size': '0.8em',
                'text-align': 'center',
                padding: '0.2em',
                display: 'flex',
                'justify-content': 'center',
                'align-items': 'center',
              }}
            >
              {(() => {
                const now = new Date();
                const zonedNow = toZonedTime(now, props.timeZone);
                return (
                  zonedNow.getHours().toString().padStart(2, '0') +
                  ':' +
                  zonedNow.getMinutes().toString().padStart(2, '0')
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
