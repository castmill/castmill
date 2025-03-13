import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import styles from './calendar-entry-box.module.scss';
import { CalendarEntry } from './calendar-entry.interface';
import { ConfirmDialog } from '@castmill/ui-common';

interface ResizeEdges {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
}

export const CalendarEntryBox: Component<{
  entry: CalendarEntry;
  cellGrid: Map<string, HTMLTableCellElement>;
  onResizeComplete: (updated: CalendarEntry) => void;
  onDelete: (id: number) => void;
  onInfo: (entry: CalendarEntry) => void;
  onDragOverCell?: (
    entry: CalendarEntry,
    ghostPosition?: { x: number; y: number }
  ) => void;
  hasOverlap?: (candidate: CalendarEntry) => boolean;
}> = (props) => {
  const [dragging, setDragging] = createSignal(false);
  const [topOffset, setTopOffset] = createSignal(0);
  const [leftOffset, setLeftOffset] = createSignal(0);

  const [height, setHeight] = createSignal(0);
  const [width, setWidth] = createSignal(0);
  // tempEntry holds the candidate event during resizing.
  const [tempEntry, setTempEntry] = createSignal<CalendarEntry | null>(null);

  // currentEntry returns the candidate (if exists) or the original.
  const currentEntry = () => tempEntry() ?? props.entry;
  const totalNumDays = 7;

  let boxRef: HTMLDivElement | undefined;

  let deltaX = 0;
  let deltaY = 0;

  let currentGhostX = 0;
  let currentGhostY = 0;

  createEffect(() => {
    if (!boxRef) {
      return;
    }

    const cleanup = draggable({
      element: boxRef!,
      getInitialData: () => ({ entry: props.entry }),
      onDragStart: ({ location }) => {
        boxRef!.style.opacity = '0.3';
        boxRef!.style.pointerEvents = 'none';

        // Calculate the relative position of the box top left corner to the mouse pointer
        const rect = boxRef!.getBoundingClientRect();

        // Get the current mouse pointer position
        deltaX = location.current.input.clientX - rect.left;
        deltaY = location.current.input.clientY - rect.top;

        setDragging(true);
      },
      onDrop: () => {
        boxRef!.style.opacity = '1';
        boxRef!.style.pointerEvents = 'auto';
        setDragging(false);
      },
      onDrag: ({ location, source }) => {
        const currentX = location.current.input.clientX;
        const currentY = location.current.input.clientY;

        currentGhostX = currentX - deltaX;
        currentGhostY = currentY - deltaY;

        // Access the entry data from source.data
        const entry = source.data.entry as CalendarEntry;

        props.onDragOverCell?.(entry, {
          x: currentGhostX,
          y: currentGhostY,
        });

        return;
      },
    });
    onCleanup(() => cleanup());
  });

  const clampEntry = (
    entry: CalendarEntry,
    totalNumDays: number
  ): CalendarEntry => {
    const newEntry = { ...entry };

    // Clamp start time
    if (newEntry.startHour < 0) {
      newEntry.startHour = 0;
      newEntry.startMinute = 0;
    } else if (newEntry.startHour > 23) {
      newEntry.startHour = 23;
      newEntry.startMinute = 30;
    } else if (newEntry.startMinute < 0) {
      newEntry.startMinute = 0;
    } else if (newEntry.startMinute > 30) {
      newEntry.startMinute = 30;
    }

    // Clamp end time
    if (newEntry.endHour < 0) {
      newEntry.endHour = 0;
      newEntry.endMinute = 0;
    } else if (newEntry.endHour > 24) {
      newEntry.endHour = 24;
      newEntry.endMinute = 0;
    } else if (newEntry.endHour === 24 && newEntry.endMinute !== 0) {
      newEntry.endHour = 23;
      newEntry.endMinute = 30;
    } else if (newEntry.endMinute < 0) {
      newEntry.endMinute = 0;
    } /*else if (newEntry.endMinute > 30) {
      newEntry.endMinute = 30;
    }*/

    // Ensure start is before end (minimum duration of 30 minutes)
    const startMinutes = newEntry.startHour * 60 + newEntry.startMinute;
    const endMinutes = newEntry.endHour * 60 + newEntry.endMinute;
    if (startMinutes >= endMinutes) {
      newEntry.endHour =
        newEntry.startHour + Math.floor((newEntry.startMinute + 30) / 60);
      newEntry.endMinute = (newEntry.startMinute + 30) % 60;
      if (newEntry.endHour > 24) {
        newEntry.endHour = 24;
        newEntry.endMinute = 0;
      }
    }

    // Clamp dayIndex
    if (newEntry.dayIndex < 0) {
      newEntry.dayIndex = 0;
    }
    if (newEntry.dayIndex + newEntry.numDays > totalNumDays) {
      newEntry.dayIndex = totalNumDays - newEntry.numDays;
    }

    return newEntry;
  };

  const slotFromTime = (hour: number, minute: number): number =>
    Math.round(hour * 2 + minute / 30);

  const updateEntryDimensions = () => {
    const entry = clampEntry(currentEntry(), 7);

    const topLeftGridCell = () =>
      `day-${entry.dayIndex}-slot-${slotFromTime(entry.startHour, entry.startMinute)}`;

    const bottomRightGridCell = () =>
      `day-${entry.dayIndex + (entry.numDays - 1)}-slot-${slotFromTime(entry.endHour, entry.endMinute) - 1}`;

    // Compute vertical offset (in px) based on the entry start time.
    function computeTop(): number {
      const cell = props.cellGrid.get(topLeftGridCell());
      return cell?.offsetTop || 0;
    }

    function computeLeft(): number {
      const cell = props.cellGrid.get(topLeftGridCell());
      return cell?.offsetLeft || 0;
    }

    function computeHeight(): number {
      const topCell = props.cellGrid.get(topLeftGridCell());
      const bottomCell = props.cellGrid.get(bottomRightGridCell());

      if (topCell && bottomCell) {
        return (
          bottomCell.offsetTop + bottomCell.offsetHeight - topCell.offsetTop
        );
      }
      return 0;
    }

    function computeWidth(): number {
      const leftCell = props.cellGrid.get(topLeftGridCell());
      const rightCell = props.cellGrid.get(bottomRightGridCell());

      if (leftCell && rightCell) {
        return (
          rightCell.offsetLeft + rightCell.offsetWidth - leftCell.offsetLeft
        );
      }
      return 0;
    }

    setTopOffset(computeTop());
    setLeftOffset(computeLeft());
    setHeight(computeHeight());
    setWidth(computeWidth());
  };

  createEffect(() => updateEntryDimensions());

  onMount(() => {
    // Create ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(() => updateEntryDimensions());

    resizeObserver.observe(boxRef!.parentElement!);

    // Cleanup on component unmount
    onCleanup(() => resizeObserver.disconnect());
  });

  // RESIZING HANDLER (GRID-BASED)
  const handleResize = (e: MouseEvent, edges: ResizeEdges) => {
    e.stopPropagation();
    e.preventDefault();

    // Set global cursor.
    const cursor =
      (edges.top || edges.bottom) && (edges.left || edges.right)
        ? 'nwse-resize'
        : edges.top || edges.bottom
          ? 'ns-resize'
          : edges.left || edges.right
            ? 'ew-resize'
            : '';
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const original = { ...props.entry };

    const measureCell = props.cellGrid.get('day-0-slot-0');
    if (!measureCell) {
      return;
    }

    const gridWidth = measureCell.offsetWidth;
    const gridHeight = measureCell.offsetHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const cellDeltaX = Math.round(deltaX / gridWidth);
      const cellDeltaY = Math.round(deltaY / gridHeight);

      let newStartSlot = slotFromTime(original.startHour, original.startMinute);
      let newEndSlot = slotFromTime(original.endHour, original.endMinute);
      let newDayIndex = original.dayIndex;
      let newNumDays = original.numDays;

      if (edges.top) {
        newStartSlot = newStartSlot + cellDeltaY;
        newStartSlot = Math.max(0, Math.min(47, newStartSlot));
      }
      if (edges.bottom) {
        newEndSlot = newEndSlot + cellDeltaY;
        newEndSlot = Math.max(1, Math.min(48, newEndSlot));
      }
      if (edges.left) {
        // For left resizing, adjust left boundary and adjust span so that the right boundary remains fixed.
        newDayIndex = original.dayIndex + cellDeltaX;
        newNumDays = original.numDays - cellDeltaX;
      }
      if (edges.right) {
        newNumDays = original.numDays + cellDeltaX;
      }

      if (newDayIndex < 0) {
        newDayIndex = 0;
      }
      if (newDayIndex + newNumDays > totalNumDays) {
        newNumDays = totalNumDays - newDayIndex;
      }
      if (newNumDays < 1) {
        newNumDays = 1;
      }
      if (newEndSlot <= newStartSlot) {
        newEndSlot = newStartSlot + 1;
      }

      const newStartHour = Math.floor(newStartSlot / 2);
      const newStartMinute = (newStartSlot % 2) * 30;
      const newEndHour = Math.floor(newEndSlot / 2);
      const newEndMinute = (newEndSlot % 2) * 30;
      const newTitle = `${newStartHour.toString().padStart(2, '0')}:${newStartMinute
        .toString()
        .padStart(
          2,
          '0'
        )}-${newEndHour.toString().padStart(2, '0')}:${newEndMinute
        .toString()
        .padStart(2, '0')}`;

      const candidate: CalendarEntry = {
        ...original,
        title: newTitle,
        startHour: newStartHour,
        startMinute: newStartMinute,
        endHour: newEndHour,
        endMinute: newEndMinute,
        dayIndex: newDayIndex,
        numDays: newNumDays,
      };

      // If hasOverlap is provided and returns true (i.e. candidate overlaps), do not update.
      if (props.hasOverlap) {
        if (!props.hasOverlap(candidate)) {
          setTempEntry(candidate);
        }
      } else {
        setTempEntry(candidate);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (tempEntry()) {
        props.onResizeComplete(tempEntry()!);
        setTempEntry(null);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Clamp currentEntry if needed (optional).
  const clampedEntry = () => currentEntry();

  const headerColor = '#6699ff';
  const weeklyHeaderColor = '#faad50';
  const regularColor = '#b0dafd';
  const weeklyColor = '#febd73';

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

  return (
    <>
      <ConfirmDialog
        show={showConfirmDialog()}
        title="Remove Channel Entry"
        message={`Are you sure you want to remove entry "${clampedEntry().title}"?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => props.onDelete(clampedEntry().id)}
      />
      <div
        ref={boxRef}
        class={styles['calendar-event']}
        style={{
          position: 'absolute',
          top: `${topOffset()}px`,
          left: `${leftOffset()}px`,
          height: `${height()}px`,
          width: `${width()}px`,
          'background-color': props.entry.weekly ? weeklyColor : regularColor,
          opacity: dragging() ? 0.5 : 1.0,
        }}
      >
        <div
          class={styles['entry-header']}
          style={{
            'background-color': props.entry.weekly
              ? weeklyHeaderColor
              : headerColor,
          }}
          onClick={(e) => {
            e.stopPropagation();
            props.onInfo(clampedEntry());
          }}
        >
          <span>{clampedEntry().title}</span>

          <span
            class={styles['entry-delete']}
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirmDialog(true);
            }}
          >
            x
          </span>
        </div>
        <div class={styles['event-body']}>{clampedEntry().playlist.name}</div>

        {/* Resizer Handles */}
        <div
          class={`${styles['resize-handle']} ${styles.top}`}
          onMouseDown={(e) => handleResize(e, { top: true })}
        />
        <div
          class={`${styles['resize-handle']} ${styles.bottom}`}
          onMouseDown={(e) => handleResize(e, { bottom: true })}
        />
        <div
          class={`${styles['resize-handle']} ${styles.left}`}
          onMouseDown={(e) => handleResize(e, { left: true })}
        />
        <div
          class={`${styles['resize-handle']} ${styles.right}`}
          onMouseDown={(e) => handleResize(e, { right: true })}
        />
        <div
          class={`${styles['resize-handle']} ${styles.corner}`}
          onMouseDown={(e) => handleResize(e, { bottom: true, right: true })}
        />
      </div>
    </>
  );
};
