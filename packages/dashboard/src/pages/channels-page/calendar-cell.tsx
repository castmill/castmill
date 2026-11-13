import { Component, onMount, onCleanup } from 'solid-js';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import styles from './calendar-view.module.scss'; // Assuming a CSS module for styling

interface CalendarCellProps {
  key: string; // Unique identifier like "day-0-slot-0"
  dropData: DropTargetData; // Data for the drop target, e.g., { dayIndex, hour, minute }
  isHovered: boolean; // Whether the cell is hovered during drag
  isCurrentDay: boolean; // Whether this cell is today's date
  cellRefs: Map<string, HTMLTableCellElement>; // Map to store cell DOM references
  canDrop: (args: { source: any }) => boolean; // Function to check if drop is allowed
  onDrop: (el: HTMLElement) => (args: { source: any }) => void; // Function to handle the drop action
  /** Tap/click on an empty slot (tap-to-add). */
  onSelect?: (data: DropTargetData) => void;
  /** Accessible name for the slot's add action. */
  ariaLabel?: string;
}

interface DropTargetData {
  dayIndex: number;
  hour: number;
  minute: number;
}

export const CalendarCell: Component<CalendarCellProps> = (props) => {
  let elRef: HTMLTableCellElement | undefined;

  // Register the cell synchronously while rendering so entry boxes can
  // measure it as soon as the visible days change (e.g. day view paging).
  const setRef = (el: HTMLTableCellElement) => {
    elRef = el;
    props.cellRefs.set(props.key, el);
  };

  onMount(() => {
    if (!elRef) return; // Safety check if ref isn't set

    // Set up the drop target
    const cleanupDropTarget = dropTargetForElements({
      element: elRef,
      getData: () => ({ ...props.dropData }),
      canDrop: props.canDrop,
      onDrop: props.onDrop(elRef),
    });

    onCleanup(() => cleanupDropTarget());
  });

  onCleanup(() => {
    if (props.cellRefs.get(props.key) === elRef) {
      props.cellRefs.delete(props.key);
    }
  });

  return (
    <td
      ref={setRef}
      classList={{
        [styles.slot]: !!props.onSelect,
        [styles.hovered]: props.isHovered,
        [styles['current-day']]: props.isCurrentDay,
      }}
      data-drop-data={JSON.stringify(props.dropData)}
    >
      {props.onSelect && (
        <button
          type="button"
          class={styles['slot-button']}
          aria-label={props.ariaLabel}
          data-drop-data={JSON.stringify(props.dropData)}
          data-testid="calendar-slot"
          onClick={() => props.onSelect?.(props.dropData)}
        />
      )}
    </td>
  );
};
