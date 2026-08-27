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
}

interface DropTargetData {
  dayIndex: number;
  hour: number;
  minute: number;
}

export const CalendarCell: Component<CalendarCellProps> = (props) => {
  let elRef: HTMLTableCellElement | undefined;

  onMount(() => {
    if (!elRef) return; // Safety check if ref isn't set

    // Register the cell in cellRefs
    props.cellRefs.set(props.key, elRef);

    // Set up the drop target
    const cleanupDropTarget = dropTargetForElements({
      element: elRef,
      getData: (args) => ({ ...props.dropData }),
      canDrop: props.canDrop,
      onDrop: props.onDrop(elRef),
    });

    // Clean up on unmount
    onCleanup(() => {
      cleanupDropTarget();
      props.cellRefs.delete(props.key);
    });
  });

  return (
    <td
      ref={elRef}
      classList={{
        [styles.hovered]: props.isHovered,
        [styles['current-day']]: props.isCurrentDay,
      }}
      data-drop-data={JSON.stringify(props.dropData)}
    />
  );
};
