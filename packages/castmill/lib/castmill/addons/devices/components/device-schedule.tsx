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
import { BsCalendar3, BsCheckLg, BsTrash, BsX } from 'solid-icons/bs';
import { DevicesService } from '../services/devices.service';
import { DeviceCardHeader } from './device-section';
import './device-schedule.scss';

// ── Types ──────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-24 (24 represents midnight/end of day)
  endMinute: number; // 0-59 (ignored when endHour is 24)
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
  // True once the pointer has left the starting cell; otherwise it is a click.
  moved?: boolean;
}

interface EditorDraft {
  startDay: number;
  endDay: number;
  startTime: string;
  endTime: string;
}

interface TapCandidate {
  pointerId: number;
  x: number;
  y: number;
  target: HTMLElement;
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
const NOW_REFRESH_MS = 30_000;
const INTL_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Current weekday (0 = Monday) and minutes since midnight. Players evaluate
 * schedules on their local clock, so prefer the device's time zone.
 */
export const getScheduleNow = (
  timeZone?: string,
  date: Date = new Date()
): { day: number; minutes: number } => {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(date);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? '';
      const day = INTL_WEEKDAYS.indexOf(part('weekday'));
      const hour = Number(part('hour')) % 24;
      const minute = Number(part('minute'));
      if (day >= 0 && Number.isFinite(hour) && Number.isFinite(minute)) {
        return { day, minutes: hour * 60 + minute };
      }
    } catch {
      // Unknown time zone: fall back to the browser clock
    }
  }
  return {
    day: (date.getDay() + 6) % 7,
    minutes: date.getHours() * 60 + date.getMinutes(),
  };
};
// Movement allowed before a touch is treated as a scroll instead of a tap
const TAP_SLOP_PX = 10;
// Keep in sync with the compact breakpoint in device-schedule.scss
const COMPACT_LAYOUT_QUERY = '(max-width: 48em), (pointer: coarse)';

let idCounter = 0;
const genId = () => `entry-${++idCounter}`;

// ── Helpers ────────────────────────────────────────────────

/** Convert hour+minute to total minutes for comparisons */
const toMinutes = (h: number, m: number) => h * 60 + m;

/** Format hour+minute as HH:MM */
const fmtTime = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Parse an <input type="time"> value into minutes since midnight */
export const parseTimeInput = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return toMinutes(h, m);
};

/**
 * Time inputs cannot represent 24:00, so an end time of 00:00 means the
 * slot runs until midnight at the end of the day.
 */
const toEndTimeInputValue = (h: number, m: number) =>
  h >= 24 ? '00:00' : fmtTime(h, m);

const isCompactLayout = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(COMPACT_LAYOUT_QUERY).matches;

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

export const DeviceSchedule: Component<{
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
  const [editor, setEditor] = createSignal<{
    entryId: string;
    isNew: boolean;
    original: ScheduleEntry;
  } | null>(null);
  const [draft, setDraft] = createSignal<EditorDraft | null>(null);
  const [editorError, setEditorError] = createSignal<string | null>(null);

  const isModified = createMemo(() => !entriesEqual(entries(), savedEntries()));
  const dayLabels = () => DAY_KEYS.map((key) => t(key));
  const editorTitleId = `schedule-editor-title-${props.device.id}`;

  let gridRef: HTMLDivElement | undefined;
  let editorRef: HTMLDivElement | undefined;
  let tapCandidate: TapCandidate | null = null;

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
    closeEditor();
    setEntries(
      savedEntries().map((e) => ({ ...e, id: genId(), days: [...e.days] }))
    );
    setSelectedId(null);
  };

  // ── Slot editor ────────────────────────────────────────

  const draftFromEntry = (entry: ScheduleEntry): EditorDraft => ({
    startDay: Math.min(...entry.days),
    endDay: Math.max(...entry.days),
    startTime: fmtTime(entry.startHour, entry.startMinute),
    endTime: toEndTimeInputValue(entry.endHour, entry.endMinute),
  });

  const openEditor = (entryId: string, isNew = false) => {
    const previous = editor();
    if (previous?.entryId === entryId) {
      isNew = isNew || previous.isNew;
    } else if (previous?.isNew) {
      // Opening another slot discards an unconfirmed tapped slot
      deleteEntry(previous.entryId);
    }
    const entry = entries().find((e) => e.id === entryId);
    if (!entry) return;
    setSelectedId(entryId);
    setEditor({
      entryId,
      isNew,
      original:
        previous?.entryId === entryId
          ? previous.original
          : { ...entry, days: [...entry.days] },
    });
    setEditorError(null);
    setDraft(draftFromEntry(entry));
    // Wait for the editor to render before moving focus into it
    setTimeout(() => {
      editorRef?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      editorRef?.querySelector<HTMLElement>('select, input')?.focus({
        preventScroll: true,
      });
    }, 0);
  };

  const closeEditor = () => {
    setEditor(null);
    setDraft(null);
    setEditorError(null);
  };

  const updateDraft = (updates: Partial<EditorDraft>) => {
    const current = draft();
    if (!current) return;
    const next = { ...current, ...updates };
    if (next.endDay < next.startDay) next.endDay = next.startDay;
    keepStartBeforeEnd(current, next, updates);
    setDraft(next);
    setEditorError(null);
  };

  // Pushes the other time when an edit would end the slot before it starts,
  // keeping the previous duration where the day allows it
  const keepStartBeforeEnd = (
    previous: EditorDraft,
    next: EditorDraft,
    updates: Partial<EditorDraft>
  ) => {
    const start = parseTimeInput(next.startTime);
    const parsedEnd = parseTimeInput(next.endTime);
    if (start === null || parsedEnd === null) return;
    const end = parsedEnd === 0 ? 24 * 60 : parsedEnd;
    if (start < end) return;

    const prevStart = parseTimeInput(previous.startTime);
    const prevEnd = parseTimeInput(previous.endTime);
    const duration =
      prevStart !== null && prevEnd !== null
        ? (prevEnd === 0 ? 24 * 60 : prevEnd) - prevStart
        : 60;
    const span = duration > 0 ? duration : 60;

    if (updates.endTime !== undefined) {
      const newStart = Math.max(0, end - span);
      next.startTime = fmtTime(Math.floor(newStart / 60), newStart % 60);
    } else {
      const newEnd = Math.min(24 * 60, start + span);
      next.endTime = toEndTimeInputValue(Math.floor(newEnd / 60), newEnd % 60);
    }
  };

  const draftToUpdates = (values: EditorDraft) => {
    const start = parseTimeInput(values.startTime);
    const parsedEnd = parseTimeInput(values.endTime);
    if (start === null || parsedEnd === null) return null;
    const end = parsedEnd === 0 ? 24 * 60 : parsedEnd;
    if (end <= start) return null;

    const days: number[] = [];
    for (let d = values.startDay; d <= values.endDay; d++) days.push(d);
    return {
      startHour: Math.floor(start / 60),
      startMinute: start % 60,
      endHour: Math.floor(end / 60),
      endMinute: end % 60,
      days,
    };
  };

  const overlapsOthers = (candidate: ScheduleEntry) =>
    entries().some(
      (existing) =>
        existing.id !== candidate.id && entriesOverlap(candidate, existing)
    );

  // Live preview of the slot being edited; null while the draft is invalid
  const editorPreview = createMemo(() => {
    const current = editor();
    const values = draft();
    if (!current || !values) return null;
    const updates = draftToUpdates(values);
    if (!updates) return null;
    const entry: ScheduleEntry = { id: current.entryId, ...updates };
    return { entry, conflict: overlapsOthers(entry) };
  });

  const displayEntry = (entry: ScheduleEntry) => {
    // A mouse drag of the edited slot takes over until it ends
    if (dragState()?.entryId === entry.id) return entry;
    const preview = editorPreview();
    return preview?.entry.id === entry.id ? preview.entry : entry;
  };

  const applyEditor = () => {
    const current = editor();
    const values = draft();
    if (!current || !values) return;

    const updates = draftToUpdates(values);
    if (!updates) {
      setEditorError(t('deviceSchedule.editor.invalidTime'));
      return;
    }
    if (overlapsOthers({ id: current.entryId, ...updates })) {
      setEditorError(t('deviceSchedule.editor.overlap'));
      return;
    }

    updateEntry(current.entryId, updates);
    closeEditor();
  };

  const cancelEditor = () => {
    const current = editor();
    // A slot created by tapping is only kept once the user confirms it
    if (current?.isNew) {
      deleteEntry(current.entryId);
    } else if (current) {
      // Drags made while editing already changed the slot, so restore it
      const stored = entries().find((e) => e.id === current.entryId);
      if (stored && !entriesEqual([stored], [current.original])) {
        const { id: _id, ...original } = current.original;
        updateEntry(current.entryId, original);
      }
    }
    closeEditor();
  };

  const deleteFromEditor = () => {
    const current = editor();
    if (current) deleteEntry(current.entryId);
    closeEditor();
  };

  const describeEntry = (entry: ScheduleEntry) => {
    const minDay = Math.min(...entry.days);
    const maxDay = Math.max(...entry.days);
    const labels = dayLabels();
    const days =
      minDay === maxDay
        ? labels[minDay]
        : `${labels[minDay]}–${labels[maxDay]}`;
    return `${days} ${fmtTime(entry.startHour, entry.startMinute)}–${fmtTime(
      entry.endHour,
      entry.endMinute
    )}`;
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
    if (editor()?.entryId === id) closeEditor();
  };

  // ── Grid coordinate helpers ────────────────────────────

  const getCellFromPoint = (
    clientX: number,
    clientY: number
  ): { day: number; hour: number } | null => {
    if (!gridRef) return null;
    const rect = gridRef.getBoundingClientRect();
    const x = clientX - rect.left - gridRef.clientLeft + gridRef.scrollLeft;
    const y = clientY - rect.top - gridRef.clientTop + gridRef.scrollTop;

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
    const dayWidth = (gridRef.clientWidth - timeLabelWidth) / 7;
    const day = Math.floor((x - timeLabelWidth) / dayWidth);

    if (hour < 0 || hour > 23 || day < 0 || day > 6) return null;
    return { day, hour };
  };

  // ── Pointer handlers ───────────────────────────────────

  /**
   * Touch and pen input cannot resize slots precisely and must keep native
   * scrolling, so a tap opens the slot editor (creating a slot if needed).
   */
  const handleTap = (clientX: number, clientY: number, target: HTMLElement) => {
    const entryEl = target.closest('.schedule-entry') as HTMLElement | null;
    if (entryEl?.dataset.entryId) {
      openEditor(entryEl.dataset.entryId);
      return;
    }

    const cell = getCellFromPoint(clientX, clientY);
    if (!cell) return;
    const newEntry: ScheduleEntry = {
      id: genId(),
      startHour: cell.hour,
      startMinute: 0,
      endHour: cell.hour + 1,
      endMinute: 0,
      days: [cell.day],
    };
    if (addEntry(newEntry)) openEditor(newEntry.id, true);
  };

  const handleGridPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select')) return;

    if (e.pointerType !== 'mouse') {
      tapCandidate = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        target,
      };
      return;
    }

    // Only handle left clicks
    if (e.button !== 0) return;

    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    // Check if we clicked on an entry
    const entryEl = target.closest('.schedule-entry') as HTMLElement | null;

    if (entryEl) {
      const entryId = entryEl.dataset.entryId;
      if (!entryId) return;

      // Start dragging from the previewed position the user sees
      const preview = editorPreview();
      if (preview?.entry.id === entryId && !preview.conflict) {
        const { id: _id, ...updates } = preview.entry;
        updateEntry(entryId, updates);
      }

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

  const isTapPointer = (e: PointerEvent) =>
    tapCandidate !== null && tapCandidate.pointerId === e.pointerId;

  const handlePointerMove = (e: PointerEvent) => {
    const tap = tapCandidate;
    if (
      tap &&
      isTapPointer(e) &&
      Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP_PX
    ) {
      tapCandidate = null;
    }

    const ds = dragState();
    if (!ds) return;

    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    const moved =
      ds.moved || cell.day !== ds.startDay || cell.hour !== ds.startHour;
    setDragState({
      ...ds,
      currentDay: cell.day,
      currentHour: cell.hour,
      moved,
    });

    // For move and resize, update in real-time
    if (ds.mode === 'move' && ds.entryId && ds.originalEntry) {
      const dayDelta = cell.day - ds.startDay;
      const hourDelta = cell.hour - ds.startHour;
      const newStart = Math.max(
        0,
        Math.min(23, ds.originalEntry.startHour + hourDelta)
      );
      const duration = ds.originalEntry.endHour - ds.originalEntry.startHour;
      const newEnd = Math.min(24, newStart + duration);
      const adjustedStart = newEnd === 24 ? 24 - duration : newStart;

      const newDays = ds.originalEntry.days
        .map((d) => d + dayDelta)
        .filter((d) => d >= 0 && d <= 6);

      if (newDays.length > 0) {
        const candidate: ScheduleEntry = {
          id: ds.entryId,
          startHour: adjustedStart,
          startMinute: ds.originalEntry.startMinute,
          endHour: Math.min(24, adjustedStart + duration),
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
        Math.min(24, cell.hour + 1)
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

  const handlePointerUp = (e: PointerEvent) => {
    const tap = tapCandidate;
    if (tap && isTapPointer(e)) {
      tapCandidate = null;
      handleTap(e.clientX, e.clientY, tap.target);
      return;
    }

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
        endHour: Math.min(24, hourMax),
        endMinute: 0,
        days,
      };

      if (addEntry(newEntry)) {
        // Resize handles are impractical on small screens, so edit directly
        if (isCompactLayout()) {
          openEditor(newEntry.id, true);
        } else {
          setSelectedId(newEntry.id);
        }
      }
    } else if (ds.entryId && !ds.moved) {
      // A click without dragging opens the same editor used on touch devices
      openEditor(ds.entryId);
    } else if (ds.entryId && editor()?.entryId === ds.entryId) {
      const entry = entries().find((item) => item.id === ds.entryId);
      if (entry) setDraft(draftFromEntry(entry));
      setEditorError(null);
    }

    // For move/resize, the updates were already applied in real-time
    setDragState(null);
  };

  const handlePointerCancel = (e: PointerEvent) => {
    if (isTapPointer(e)) tapCandidate = null;
  };

  // Global pointer event listeners
  onMount(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  });

  const [now, setNow] = createSignal(getScheduleNow(props.device.timezone));
  const nowTimer = setInterval(
    () => setNow(getScheduleNow(props.device.timezone)),
    NOW_REFRESH_MS
  );

  onCleanup(() => {
    clearInterval(nowTimer);
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerCancel);
  });

  // ── Compute entry positions ────────────────────────────

  const getNowLineTop = () => {
    const headerEl = gridRef?.querySelector(
      '.schedule-grid-day-header'
    ) as HTMLElement | null;
    const headerH = headerEl?.offsetHeight || CELL_HEIGHT_PX;
    return `${(now().minutes / 60) * CELL_HEIGHT_PX + headerH}px`;
  };

  const getEntryStyle = (entry: ScheduleEntry): Record<string, string> => {
    if (!gridRef) return {};
    const headerEl = gridRef.querySelector(
      '.schedule-grid-day-header'
    ) as HTMLElement | null;
    const headerH = headerEl ? headerEl.offsetHeight : CELL_HEIGHT_PX;
    const minDay = Math.min(...entry.days);
    const maxDay = Math.max(...entry.days);

    const startFrac = entry.startHour + entry.startMinute / 60;
    const endFrac = entry.endHour + entry.endMinute / 60;

    return {
      top: `${startFrac * CELL_HEIGHT_PX + headerH}px`,
      left: `calc(${(minDay / 7) * 100}% + 1px)`,
      width: `calc(${((maxDay - minDay + 1) / 7) * 100}% - 2px)`,
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
    const dayMin = Math.min(ds.startDay, ds.currentDay);
    const dayMax = Math.max(ds.startDay, ds.currentDay);
    const hourMin = Math.min(ds.startHour, ds.currentHour);
    const hourMax = Math.max(ds.startHour, ds.currentHour) + 1;

    return {
      top: `${hourMin * CELL_HEIGHT_PX + headerH}px`,
      left: `calc(${(dayMin / 7) * 100}% + 1px)`,
      width: `calc(${((dayMax - dayMin + 1) / 7) * 100}% - 2px)`,
      height: `${(hourMax - hourMin) * CELL_HEIGHT_PX - 1}px`,
    };
  };

  // ── Summary ────────────────────────────────────────────

  const summary = createMemo(() => buildSummary(entries(), t));

  // ── Render ─────────────────────────────────────────────

  return (
    <section class="device-card schedule-grid-container">
      <DeviceCardHeader
        icon={BsCalendar3}
        title={t('deviceSchedule.title')}
        description={t('deviceSchedule.description')}
      />

      <div
        class="schedule-grid-wrapper"
        onPointerDown={handleGridPointerDown}
        ref={gridRef}
      >
        <div class="schedule-grid">
          {/* Corner cell */}
          <div class="schedule-grid-corner" />

          {/* Day headers */}
          <For each={DAY_KEYS}>
            {(dayKey, day) => (
              <div
                class={`schedule-grid-day-header${
                  now().day === day() ? ' today' : ''
                }`}
                title={t(dayKey)}
                aria-current={now().day === day() ? 'date' : undefined}
              >
                {t(dayKey)}
              </div>
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
                  {(day) => (
                    <div
                      class={`schedule-grid-cell${
                        now().day === day ? ' today' : ''
                      }`}
                    />
                  )}
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
                }${editorPreview()?.entry.id === entry.id ? ' previewing' : ''}${
                  editorPreview()?.entry.id === entry.id &&
                  editorPreview()?.conflict
                    ? ' conflict'
                    : ''
                }`}
                data-entry-id={entry.id}
                style={getEntryStyle(displayEntry(entry))}
                role="button"
                tabIndex={0}
                aria-label={t('deviceSchedule.editor.editSlot', {
                  slot: describeEntry(displayEntry(entry)),
                })}
                aria-pressed={editor()?.entryId === entry.id}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openEditor(entry.id);
                  }
                }}
              >
                <div class="schedule-entry-resize-top" />
                <div class="schedule-entry-resize-left" />
                <span class="schedule-entry-label" aria-hidden="true">
                  {fmtTime(
                    displayEntry(entry).startHour,
                    displayEntry(entry).startMinute
                  )}
                  –
                  {fmtTime(
                    displayEntry(entry).endHour,
                    displayEntry(entry).endMinute
                  )}
                </span>
                <button
                  type="button"
                  class="schedule-entry-delete"
                  aria-label={t('deviceSchedule.delete')}
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

          {/* Current time, emphasised in today's column */}
          <div
            class="schedule-now-line"
            style={{ top: getNowLineTop() }}
            aria-hidden="true"
          >
            <div
              class="schedule-now-marker"
              style={{
                left: `${(now().day / 7) * 100}%`,
                width: `${100 / 7}%`,
              }}
            />
          </div>

          {/* Create drag preview */}
          <Show when={getDragPreviewStyle()}>
            {(style) => <div class="schedule-drag-preview" style={style()} />}
          </Show>
        </div>
      </div>

      <Show when={draft()}>
        {(values) => (
          <div
            class="schedule-editor"
            role="group"
            aria-labelledby={editorTitleId}
            ref={editorRef}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditor();
              } else if (
                e.key === 'Enter' &&
                (e.target as HTMLElement).tagName !== 'BUTTON'
              ) {
                e.preventDefault();
                applyEditor();
              }
            }}
          >
            <h4 id={editorTitleId} class="schedule-editor-title">
              {editor()?.isNew
                ? t('deviceSchedule.editor.newTitle')
                : t('deviceSchedule.editor.title')}
            </h4>
            <div class="schedule-editor-fields">
              <label class="schedule-editor-field">
                <span>{t('deviceSchedule.editor.startDay')}</span>
                <select
                  value={values().startDay}
                  onChange={(e) =>
                    updateDraft({ startDay: Number(e.currentTarget.value) })
                  }
                >
                  <For each={dayLabels()}>
                    {(label, i) => (
                      <option value={i()} selected={i() === values().startDay}>
                        {label}
                      </option>
                    )}
                  </For>
                </select>
              </label>
              <label class="schedule-editor-field">
                <span>{t('deviceSchedule.editor.endDay')}</span>
                <select
                  value={values().endDay}
                  onChange={(e) =>
                    updateDraft({ endDay: Number(e.currentTarget.value) })
                  }
                >
                  <For each={dayLabels()}>
                    {(label, i) => (
                      <option
                        value={i()}
                        selected={i() === values().endDay}
                        disabled={i() < values().startDay}
                      >
                        {label}
                      </option>
                    )}
                  </For>
                </select>
              </label>
              <label class="schedule-editor-field">
                <span>{t('deviceSchedule.editor.startTime')}</span>
                <input
                  type="time"
                  step="60"
                  value={values().startTime}
                  onInput={(e) =>
                    updateDraft({ startTime: e.currentTarget.value })
                  }
                />
              </label>
              <label class="schedule-editor-field">
                <span>{t('deviceSchedule.editor.endTime')}</span>
                <input
                  type="time"
                  step="60"
                  value={values().endTime}
                  onInput={(e) =>
                    updateDraft({ endTime: e.currentTarget.value })
                  }
                />
              </label>
            </div>
            <p class="schedule-editor-hint">
              {t('deviceSchedule.editor.midnightHint')}
            </p>
            <Show when={editorError()}>
              {(error) => (
                <p class="schedule-editor-error" role="alert">
                  {error()}
                </p>
              )}
            </Show>
            <div class="schedule-editor-actions">
              <Button
                onClick={deleteFromEditor}
                label={t('deviceSchedule.delete')}
                icon={BsTrash}
                color="danger"
              />
              <div class="schedule-editor-actions-end">
                <Button
                  onClick={cancelEditor}
                  label={t('common.cancel')}
                  color="secondary"
                />
                <Button
                  onClick={applyEditor}
                  label={t('deviceSchedule.editor.done')}
                  icon={BsCheckLg}
                  color="primary"
                />
              </div>
            </div>
          </div>
        )}
      </Show>

      <footer class="device-card-footer schedule-footer">
        <p class="schedule-summary" aria-live="polite">
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
        </p>
        <div class="schedule-actions">
          <Show when={loading()}>
            <span class="schedule-loading">{t('common.loading')}</span>
          </Show>
          <Button
            onClick={resetSchedule}
            label={t('deviceSchedule.reset')}
            icon={BsX}
            color="secondary"
            disabled={!isModified() || loading()}
          />
          <Button
            onClick={saveSchedule}
            color="success"
            icon={BsCheckLg}
            label={t('common.save')}
            disabled={!isModified() || loading()}
          />
        </div>
      </footer>
    </section>
  );
};
