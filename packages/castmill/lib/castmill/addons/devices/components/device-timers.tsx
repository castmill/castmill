import {
  Component,
  createSignal,
  For,
  Show,
  onMount,
  onCleanup,
  createMemo,
} from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { Button, useToast } from '@castmill/ui-common';
import { DevicesService } from '../services/devices.service';
import './device-timers.scss';

// ── Types ──────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
  days: number[]; // 0=Mon .. 6=Sun
}

interface DragState {
  mode:
    | 'create'
    | 'move'
    | 'resize-top'
    | 'resize-bottom'
    | 'resize-left'
    | 'resize-right';
  entryId?: string;
  startDay: number;
  startHour: number;
  currentDay: number;
  currentHour: number;
  // For move: offset from top of entry
  offsetHour?: number;
  originalEntry?: ScheduleEntry;
}

// ── Constants ──────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_KEYS = [
  'deviceSchedule.mon',
  'deviceSchedule.tue',
  'deviceSchedule.wed',
  'deviceSchedule.thu',
  'deviceSchedule.fri',
  'deviceSchedule.sat',
  'deviceSchedule.sun',
];
const CELL_HEIGHT_PX = 20; // px — matches CSS

let idCounter = 0;
const genId = () => `entry-${++idCounter}`;

// ── Helpers ────────────────────────────────────────────────

/** Convert hour+minute to total minutes for comparisons */
const toMinutes = (h: number, m: number) => h * 60 + m;

/** Format hour+minute as HH:MM */
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Format as HH:MM value for <input type="time"> */
const toTimeInputValue = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Check if two entries overlap */
function entriesOverlap(a: ScheduleEntry, b: ScheduleEntry): boolean {
  const sharedDays = a.days.filter((d) => b.days.includes(d));
  if (sharedDays.length === 0) return false;
  const aStart = toMinutes(a.startHour, a.startMinute);
  const aEnd = toMinutes(a.endHour, a.endMinute);
  const bStart = toMinutes(b.startHour, b.startMinute);
  const bEnd = toMinutes(b.endHour, b.endMinute);
  return aStart < bEnd && bStart < aEnd;
}

/** Deep equal for entries (order-insensitive for days array) */
function entriesEqual(a: ScheduleEntry[], b: ScheduleEntry[]): boolean {
  if (a.length !== b.length) return false;
  const normalize = (entries: ScheduleEntry[]) =>
    entries
      .map((e) => ({
        startHour: e.startHour,
        startMinute: e.startMinute,
        endHour: e.endHour,
        endMinute: e.endMinute,
        days: [...e.days].sort(),
      }))
      .sort(
        (x, y) =>
          toMinutes(x.startHour, x.startMinute) -
            toMinutes(y.startHour, y.startMinute) ||
          toMinutes(x.endHour, x.endMinute) -
            toMinutes(y.endHour, y.endMinute) ||
          x.days[0] - y.days[0]
      );

  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Build a human-readable summary string */
export function buildSummary(
  entries: ScheduleEntry[],
  t: (key: string, params?: Record<string, any>) => string
): string {
  if (entries.length === 0) {
    return t('deviceSchedule.noScheduleAlwaysOn');
  }

  // Group by time range
  const groups: Record<string, number[]> = {};
  for (const e of entries) {
    const key = `${fmtTime(e.startHour, e.startMinute)}–${fmtTime(e.endHour, e.endMinute)}`;
    if (!groups[key]) groups[key] = [];
    for (const d of e.days) {
      if (!groups[key].includes(d)) groups[key].push(d);
    }
  }

  const dayLabels = [
    t('deviceSchedule.mon'),
    t('deviceSchedule.tue'),
    t('deviceSchedule.wed'),
    t('deviceSchedule.thu'),
    t('deviceSchedule.fri'),
    t('deviceSchedule.sat'),
    t('deviceSchedule.sun'),
  ];

  const parts: string[] = [];
  for (const [timeRange, days] of Object.entries(groups)) {
    const sorted = [...days].sort();
    const dayStr = formatDayRange(sorted, dayLabels);
    parts.push(`${dayStr} ${timeRange}`);
  }

  return `${t('deviceSchedule.onLabel')}: ${parts.join(', ')}`;
}

/** Format day indices into compact ranges like "Mon–Fri" */
function formatDayRange(days: number[], labels: string[]): string {
  if (days.length === 7) return `${labels[0]}–${labels[6]}`;
  if (days.length === 0) return '';

  const ranges: string[] = [];
  let rangeStart = days[0];
  let rangeEnd = days[0];

  for (let i = 1; i < days.length; i++) {
    if (days[i] === rangeEnd + 1) {
      rangeEnd = days[i];
    } else {
      ranges.push(
        rangeStart === rangeEnd
          ? labels[rangeStart]
          : `${labels[rangeStart]}–${labels[rangeEnd]}`
      );
      rangeStart = days[i];
      rangeEnd = days[i];
    }
  }
  ranges.push(
    rangeStart === rangeEnd
      ? labels[rangeStart]
      : `${labels[rangeStart]}–${labels[rangeEnd]}`
  );

  return ranges.join(', ');
}

// ── Component ──────────────────────────────────────────────

export const DeviceTimers: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const [loading, setLoading] = createSignal(false);
  const [entries, setEntries] = createSignal<ScheduleEntry[]>([]);
  const [savedEntries, setSavedEntries] = createSignal<ScheduleEntry[]>([]);
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [editingTime, setEditingTime] = createSignal<{
    entryId: string;
    field: 'start' | 'end';
  } | null>(null);

  const isModified = createMemo(() => !entriesEqual(entries(), savedEntries()));

  let gridRef: HTMLDivElement | undefined;

  // ── Load / Save ─────────────────────────────────────────

  onMount(async () => {
    await loadSchedule();
  });

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const result = await DevicesService.getDeviceSchedule(
        props.baseUrl,
        props.device.id
      );
      const loaded = (result.entries || []).map((e) => ({
        id: genId(),
        startHour: e.startHour,
        startMinute: e.startMinute || 0,
        endHour: e.endHour,
        endMinute: e.endMinute || 0,
        days: e.days || [],
      }));
      setEntries(loaded);
      setSavedEntries(loaded.map((e) => ({ ...e, days: [...e.days] })));
    } catch (err) {
      toast.error(t('deviceSchedule.loadError'));
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    setLoading(true);
    try {
      const toSave = entries().map((e) => ({
        startHour: e.startHour,
        startMinute: e.startMinute,
        endHour: e.endHour,
        endMinute: e.endMinute,
        days: e.days,
      }));
      const result = await DevicesService.setDeviceSchedule(
        props.baseUrl,
        props.device.id,
        toSave
      );

      if (!result.timers_sent) {
        toast.warning(t('deviceSchedule.savedOffline'));
      } else {
        toast.success(t('deviceSchedule.saved'));
      }

      setSavedEntries(entries().map((e) => ({ ...e, days: [...e.days] })));
    } catch (err) {
      toast.error(t('deviceSchedule.saveError'));
      console.error('Error saving schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetSchedule = () => {
    setEntries(
      savedEntries().map((e) => ({ ...e, id: genId(), days: [...e.days] }))
    );
    setSelectedId(null);
  };

  // ── Time input editing ──────────────────────────────────

  const handleTimeChange = (
    entryId: string,
    field: 'start' | 'end',
    value: string
  ) => {
    const [hStr, mStr] = value.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return;

    const entry = entries().find((e) => e.id === entryId);
    if (!entry) return;

    let updates: Partial<ScheduleEntry>;
    if (field === 'start') {
      // Start must be before end
      const newStartMins = toMinutes(h, m);
      const endMins = toMinutes(entry.endHour, entry.endMinute);
      if (newStartMins >= endMins) return;
      updates = { startHour: h, startMinute: m };
    } else {
      // End must be after start
      const startMins = toMinutes(entry.startHour, entry.startMinute);
      const newEndMins = toMinutes(h, m);
      if (newEndMins <= startMins) return;
      updates = { endHour: h, endMinute: m };
    }

    const candidate: ScheduleEntry = { ...entry, ...updates };
    const hasOverlap = entries().some(
      (existing) =>
        existing.id !== entryId && entriesOverlap(candidate, existing)
    );
    if (!hasOverlap) {
      updateEntry(entryId, updates);
    }
    setEditingTime(null);
  };

  // ── Entry CRUD ─────────────────────────────────────────

  const addEntry = (entry: ScheduleEntry) => {
    // Check for overlaps
    for (const existing of entries()) {
      if (entriesOverlap(entry, existing)) {
        return false;
      }
    }
    setEntries([...entries(), entry]);
    return true;
  };

  const updateEntry = (id: string, updates: Partial<ScheduleEntry>) => {
    setEntries(entries().map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const deleteEntry = (id: string) => {
    setEntries(entries().filter((e) => e.id !== id));
    if (selectedId() === id) setSelectedId(null);
  };

  // ── Grid coordinate helpers ────────────────────────────

  const getCellFromPoint = (
    clientX: number,
    clientY: number
  ): { day: number; hour: number } | null => {
    if (!gridRef) return null;
    const rect = gridRef.getBoundingClientRect();
    const x = clientX - rect.left + gridRef.scrollLeft;
    const y = clientY - rect.top + gridRef.scrollTop;

    // Read the actual header row height from the DOM
    const headerEl = gridRef.querySelector(
      '.schedule-grid-day-header'
    ) as HTMLElement | null;
    const headerH = headerEl ? headerEl.offsetHeight : CELL_HEIGHT_PX;

    // Time label column width
    const timeLabelEl = gridRef.querySelector(
      '.schedule-grid-time-label'
    ) as HTMLElement | null;
    const timeLabelWidth = timeLabelEl
      ? timeLabelEl.offsetWidth
      : 3.5 * parseFloat(getComputedStyle(gridRef).fontSize);

    const hour = Math.floor((y - headerH) / CELL_HEIGHT_PX);
    const dayWidth = (rect.width - timeLabelWidth) / 7;
    const day = Math.floor((x - timeLabelWidth) / dayWidth);

    if (hour < 0 || hour > 23 || day < 0 || day > 6) return null;
    return { day, hour };
  };

  // ── Mouse handlers ─────────────────────────────────────

  const handleGridMouseDown = (e: MouseEvent) => {
    // Only handle left clicks
    if (e.button !== 0) return;

    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Check if we clicked on an entry
    const target = e.target as HTMLElement;
    const entryEl = target.closest('.schedule-entry') as HTMLElement | null;

    if (entryEl) {
      const entryId = entryEl.dataset.entryId;
      if (!entryId) return;

      // Check if clicking a resize handle
      if (target.classList.contains('schedule-entry-resize-top')) {
        const entry = entries().find((e) => e.id === entryId);
        if (!entry) return;
        setSelectedId(entryId);
        setDragState({
          mode: 'resize-top',
          entryId,
          startDay: cell.day,
          startHour: cell.hour,
          currentDay: cell.day,
          currentHour: cell.hour,
          originalEntry: { ...entry, days: [...entry.days] },
        });
        e.preventDefault();
        return;
      }

      if (target.classList.contains('schedule-entry-resize-bottom')) {
        const entry = entries().find((e) => e.id === entryId);
        if (!entry) return;
        setSelectedId(entryId);
        setDragState({
          mode: 'resize-bottom',
          entryId,
          startDay: cell.day,
          startHour: cell.hour,
          currentDay: cell.day,
          currentHour: cell.hour,
          originalEntry: { ...entry, days: [...entry.days] },
        });
        e.preventDefault();
        return;
      }

      if (target.classList.contains('schedule-entry-resize-left')) {
        const entry = entries().find((e) => e.id === entryId);
        if (!entry) return;
        setSelectedId(entryId);
        setDragState({
          mode: 'resize-left',
          entryId,
          startDay: cell.day,
          startHour: cell.hour,
          currentDay: cell.day,
          currentHour: cell.hour,
          originalEntry: { ...entry, days: [...entry.days] },
        });
        e.preventDefault();
        return;
      }

      if (target.classList.contains('schedule-entry-resize-right')) {
        const entry = entries().find((e) => e.id === entryId);
        if (!entry) return;
        setSelectedId(entryId);
        setDragState({
          mode: 'resize-right',
          entryId,
          startDay: cell.day,
          startHour: cell.hour,
          currentDay: cell.day,
          currentHour: cell.hour,
          originalEntry: { ...entry, days: [...entry.days] },
        });
        e.preventDefault();
        return;
      }

      if (target.classList.contains('schedule-entry-delete')) {
        return; // Let the delete button handle it
      }

      // Click on entry body — select or start move
      const entry = entries().find((e) => e.id === entryId);
      if (!entry) return;
      setSelectedId(entryId);
      setDragState({
        mode: 'move',
        entryId,
        startDay: cell.day,
        startHour: cell.hour,
        currentDay: cell.day,
        currentHour: cell.hour,
        offsetHour: cell.hour - entry.startHour,
        originalEntry: { ...entry, days: [...entry.days] },
      });
      e.preventDefault();
      return;
    }

    // Clicked on empty space — deselect and start creating
    setSelectedId(null);
    setDragState({
      mode: 'create',
      startDay: cell.day,
      startHour: cell.hour,
      currentDay: cell.day,
      currentHour: cell.hour,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    const ds = dragState();
    if (!ds) return;

    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    setDragState({ ...ds, currentDay: cell.day, currentHour: cell.hour });

    // For move and resize, update in real-time
    if (ds.mode === 'move' && ds.entryId && ds.originalEntry) {
      const dayDelta = cell.day - ds.startDay;
      const hourDelta = cell.hour - ds.startHour;
      const newStart = Math.max(
        0,
        Math.min(23, ds.originalEntry.startHour + hourDelta)
      );
      const duration = ds.originalEntry.endHour - ds.originalEntry.startHour;
      const newEnd = Math.min(23, newStart + duration);
      const adjustedStart = newEnd === 23 ? 23 - duration : newStart;

      const newDays = ds.originalEntry.days
        .map((d) => d + dayDelta)
        .filter((d) => d >= 0 && d <= 6);

      if (newDays.length > 0) {
        const candidate: ScheduleEntry = {
          id: ds.entryId,
          startHour: adjustedStart,
          startMinute: ds.originalEntry.startMinute,
          endHour: Math.min(23, adjustedStart + duration),
          endMinute: ds.originalEntry.endMinute,
          days: newDays,
        };

        // Check overlap with other entries
        const hasOverlap = entries().some(
          (existing) =>
            existing.id !== ds.entryId && entriesOverlap(candidate, existing)
        );

        if (!hasOverlap) {
          updateEntry(ds.entryId, {
            startHour: candidate.startHour,
            endHour: candidate.endHour,
            days: candidate.days,
          });
        }
      }
    }

    if (ds.mode === 'resize-top' && ds.entryId && ds.originalEntry) {
      const newStart = Math.max(
        0,
        Math.min(ds.originalEntry.endHour - 1, cell.hour)
      );
      const candidate: ScheduleEntry = {
        ...ds.originalEntry,
        startHour: newStart,
        startMinute: 0,
      };
      const hasOverlap = entries().some(
        (existing) =>
          existing.id !== ds.entryId && entriesOverlap(candidate, existing)
      );
      if (!hasOverlap) {
        updateEntry(ds.entryId, { startHour: newStart, startMinute: 0 });
      }
    }

    if (ds.mode === 'resize-bottom' && ds.entryId && ds.originalEntry) {
      const newEnd = Math.max(
        ds.originalEntry.startHour + 1,
        Math.min(23, cell.hour + 1)
      );
      const candidate: ScheduleEntry = {
        ...ds.originalEntry,
        endHour: newEnd,
        endMinute: 0,
      };
      const hasOverlap = entries().some(
        (existing) =>
          existing.id !== ds.entryId && entriesOverlap(candidate, existing)
      );
      if (!hasOverlap) {
        updateEntry(ds.entryId, { endHour: newEnd, endMinute: 0 });
      }
    }

    if (ds.mode === 'resize-left' && ds.entryId && ds.originalEntry) {
      const origDays = [...ds.originalEntry.days].sort((a, b) => a - b);
      const maxDay = origDays[origDays.length - 1];
      const newMinDay = Math.max(0, Math.min(maxDay, cell.day));
      const newDays: number[] = [];
      for (let d = newMinDay; d <= maxDay; d++) newDays.push(d);
      const candidate: ScheduleEntry = {
        ...ds.originalEntry,
        days: newDays,
      };
      const hasOverlap = entries().some(
        (existing) =>
          existing.id !== ds.entryId && entriesOverlap(candidate, existing)
      );
      if (!hasOverlap) {
        updateEntry(ds.entryId, { days: newDays });
      }
    }

    if (ds.mode === 'resize-right' && ds.entryId && ds.originalEntry) {
      const origDays = [...ds.originalEntry.days].sort((a, b) => a - b);
      const minDay = origDays[0];
      const newMaxDay = Math.max(minDay, Math.min(6, cell.day));
      const newDays: number[] = [];
      for (let d = minDay; d <= newMaxDay; d++) newDays.push(d);
      const candidate: ScheduleEntry = {
        ...ds.originalEntry,
        days: newDays,
      };
      const hasOverlap = entries().some(
        (existing) =>
          existing.id !== ds.entryId && entriesOverlap(candidate, existing)
      );
      if (!hasOverlap) {
        updateEntry(ds.entryId, { days: newDays });
      }
    }
  };

  const handleMouseUp = (_e: MouseEvent) => {
    const ds = dragState();
    if (!ds) return;

    if (ds.mode === 'create') {
      const dayMin = Math.min(ds.startDay, ds.currentDay);
      const dayMax = Math.max(ds.startDay, ds.currentDay);
      const hourMin = Math.min(ds.startHour, ds.currentHour);
      const hourMax = Math.max(ds.startHour, ds.currentHour) + 1;

      const days: number[] = [];
      for (let d = dayMin; d <= dayMax; d++) days.push(d);

      const newEntry: ScheduleEntry = {
        id: genId(),
        startHour: hourMin,
        startMinute: 0,
        endHour: Math.min(23, hourMax),
        endMinute: 0,
        days,
      };

      if (addEntry(newEntry)) {
        setSelectedId(newEntry.id);
      }
    }

    // For move/resize, the updates were already applied in real-time
    setDragState(null);
  };

  // Global mouse event listeners
  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  // ── Compute entry positions ────────────────────────────

  const getEntryStyle = (entry: ScheduleEntry): Record<string, string> => {
    if (!gridRef) return {};
    const headerEl = gridRef.querySelector(
      '.schedule-grid-day-header'
    ) as HTMLElement | null;
    const headerH = headerEl ? headerEl.offsetHeight : CELL_HEIGHT_PX;
    const timeLabelEl = gridRef.querySelector(
      '.schedule-grid-time-label'
    ) as HTMLElement | null;
    const timeLabelWidth = timeLabelEl
      ? timeLabelEl.offsetWidth
      : 3.5 * parseFloat(getComputedStyle(gridRef).fontSize);
    const gridWidth = gridRef.getBoundingClientRect().width;
    const dayWidth = (gridWidth - timeLabelWidth) / 7;

    const minDay = Math.min(...entry.days);
    const maxDay = Math.max(...entry.days);

    const startFrac = entry.startHour + entry.startMinute / 60;
    const endFrac = entry.endHour + entry.endMinute / 60;

    return {
      top: `${startFrac * CELL_HEIGHT_PX + headerH}px`,
      left: `${timeLabelWidth + minDay * dayWidth + 1}px`,
      width: `${(maxDay - minDay + 1) * dayWidth - 2}px`,
      height: `${(endFrac - startFrac) * CELL_HEIGHT_PX - 1}px`,
    };
  };

  // Drag preview for create mode
  const getDragPreviewStyle = (): Record<string, string> | null => {
    const ds = dragState();
    if (!ds || ds.mode !== 'create' || !gridRef) return null;

    const headerEl = gridRef.querySelector(
      '.schedule-grid-day-header'
    ) as HTMLElement | null;
    const headerH = headerEl ? headerEl.offsetHeight : CELL_HEIGHT_PX;
    const timeLabelEl = gridRef.querySelector(
      '.schedule-grid-time-label'
    ) as HTMLElement | null;
    const timeLabelWidth = timeLabelEl
      ? timeLabelEl.offsetWidth
      : 3.5 * parseFloat(getComputedStyle(gridRef).fontSize);
    const gridWidth = gridRef.getBoundingClientRect().width;
    const dayWidth = (gridWidth - timeLabelWidth) / 7;

    const dayMin = Math.min(ds.startDay, ds.currentDay);
    const dayMax = Math.max(ds.startDay, ds.currentDay);
    const hourMin = Math.min(ds.startHour, ds.currentHour);
    const hourMax = Math.max(ds.startHour, ds.currentHour) + 1;

    return {
      top: `${hourMin * CELL_HEIGHT_PX + headerH}px`,
      left: `${timeLabelWidth + dayMin * dayWidth + 1}px`,
      width: `${(dayMax - dayMin + 1) * dayWidth - 2}px`,
      height: `${(hourMax - hourMin) * CELL_HEIGHT_PX - 1}px`,
    };
  };

  // ── Summary ────────────────────────────────────────────

  const summary = createMemo(() => buildSummary(entries(), t));

  // ── Render ─────────────────────────────────────────────

  return (
    <div class="schedule-grid-container">
      <p class="schedule-grid-description">{t('deviceSchedule.description')}</p>

      <div
        class="schedule-grid-wrapper"
        onMouseDown={handleGridMouseDown}
        ref={gridRef}
      >
        <div class="schedule-grid">
          {/* Corner cell */}
          <div class="schedule-grid-corner" />

          {/* Day headers */}
          <For each={DAY_KEYS}>
            {(dayKey) => (
              <div class="schedule-grid-day-header">{t(dayKey)}</div>
            )}
          </For>

          {/* Hour rows */}
          <For each={HOURS}>
            {(hour) => (
              <>
                {/* Time label */}
                <div class="schedule-grid-time-label">{fmtTime(hour, 0)}</div>

                {/* Day cells for this hour */}
                <For each={[0, 1, 2, 3, 4, 5, 6]}>
                  {(_day) => <div class="schedule-grid-cell" />}
                </For>
              </>
            )}
          </For>
        </div>

        {/* Entry overlay layer */}
        <div class="schedule-entry-layer">
          <For each={entries()}>
            {(entry) => (
              <div
                class={`schedule-entry${selectedId() === entry.id ? ' selected' : ''}${
                  dragState()?.entryId === entry.id ? ' dragging' : ''
                }`}
                data-entry-id={entry.id}
                style={getEntryStyle(entry)}
              >
                <div class="schedule-entry-resize-top" />
                <div class="schedule-entry-resize-left" />
                <span class="schedule-entry-label">
                  <Show
                    when={
                      editingTime()?.entryId === entry.id &&
                      editingTime()?.field === 'start'
                    }
                    fallback={
                      <span
                        class="schedule-entry-time-clickable"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTime({ entryId: entry.id, field: 'start' });
                        }}
                      >
                        {fmtTime(entry.startHour, entry.startMinute)}
                      </span>
                    }
                  >
                    <input
                      type="time"
                      class="schedule-entry-time-input"
                      value={toTimeInputValue(
                        entry.startHour,
                        entry.startMinute
                      )}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        handleTimeChange(
                          entry.id,
                          'start',
                          e.currentTarget.value
                        );
                        setEditingTime(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTimeChange(
                            entry.id,
                            'start',
                            e.currentTarget.value
                          );
                          setEditingTime(null);
                        } else if (e.key === 'Escape') {
                          setEditingTime(null);
                        }
                      }}
                      ref={(el) => setTimeout(() => el.focus(), 0)}
                    />
                  </Show>
                  <span>–</span>
                  <Show
                    when={
                      editingTime()?.entryId === entry.id &&
                      editingTime()?.field === 'end'
                    }
                    fallback={
                      <span
                        class="schedule-entry-time-clickable"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTime({ entryId: entry.id, field: 'end' });
                        }}
                      >
                        {fmtTime(entry.endHour, entry.endMinute)}
                      </span>
                    }
                  >
                    <input
                      type="time"
                      class="schedule-entry-time-input"
                      value={toTimeInputValue(entry.endHour, entry.endMinute)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        handleTimeChange(
                          entry.id,
                          'end',
                          e.currentTarget.value
                        );
                        setEditingTime(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleTimeChange(
                            entry.id,
                            'end',
                            e.currentTarget.value
                          );
                          setEditingTime(null);
                        } else if (e.key === 'Escape') {
                          setEditingTime(null);
                        }
                      }}
                      ref={(el) => setTimeout(() => el.focus(), 0)}
                    />
                  </Show>
                </span>
                <button
                  class="schedule-entry-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteEntry(entry.id);
                  }}
                  title={t('deviceSchedule.delete')}
                >
                  ×
                </button>
                <div class="schedule-entry-resize-right" />
                <div class="schedule-entry-resize-bottom" />
              </div>
            )}
          </For>

          {/* Create drag preview */}
          <Show when={getDragPreviewStyle()}>
            {(style) => <div class="schedule-drag-preview" style={style()} />}
          </Show>
        </div>
      </div>

      {/* Schedule summary */}
      <div class="schedule-summary">
        <Show
          when={entries().length > 0}
          fallback={
            <span class="schedule-summary-always-on">
              {t('deviceSchedule.noScheduleAlwaysOn')}
            </span>
          }
        >
          {summary()}
        </Show>
      </div>

      {/* Actions */}
      <div class="schedule-actions">
        <Button
          onClick={saveSchedule}
          color="primary"
          label={t('deviceSchedule.save')}
          disabled={!isModified() || loading()}
        />
        <Button
          onClick={resetSchedule}
          label={t('deviceSchedule.reset')}
          disabled={!isModified() || loading()}
        />
      </div>

      <Show when={loading()}>
        <div class="schedule-loading">{t('common.loading')}</div>
      </Show>
    </div>
  );
};
