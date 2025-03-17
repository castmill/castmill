import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { JsonPlaylist } from '@castmill/player';
import { Component, createEffect, createSignal, onCleanup } from 'solid-js';
import { CalendarEntry } from './calendar-entry.interface';

import styles from './playlist-chooser-item.module.scss';
import { RiEditorDraggable } from 'solid-icons/ri';

interface PlaylistChooserItemProps {
  playlist: JsonPlaylist;
  onDragOverCell?: (
    entry: CalendarEntry,
    ghostPosition?: { x: number; y: number }
  ) => void;
  hasOverlap?: (candidate: CalendarEntry) => boolean;
}

export const PlaylistChooserItem: Component<PlaylistChooserItemProps> = (
  props
) => {
  const [dragging, setDragging] = createSignal(false);
  const [selectedPlaylist, setSelectedPlaylist] =
    createSignal<JsonPlaylist | null>(null);

  let ref: HTMLElement | undefined;
  let deltaX = 0;
  let deltaY = 0;
  let currentGhostX = 0;
  let currentGhostY = 0;

  createEffect(() => {
    const cleanup = draggable({
      element: ref!,
      getInitialData: () => ({
        entry: {
          isNewEntry: true,
          playlist: props.playlist,
          numDays: 1,
          startHour: 0,
          startMinute: 0,
          endHour: 1,
          endMinute: 0,
        },
      }),
      onDragStart: ({ location }) => {
        if (!ref) {
          return;
        }

        ref!.style.opacity = '0.3';
        ref!.style.pointerEvents = 'none';

        // Calculate the relative position of the box top left corner to the mouse pointer
        const rect = ref!.getBoundingClientRect();

        // Get the current mouse pointer position
        deltaX = location.current.input.clientX - rect.left;
        deltaY = location.current.input.clientY - rect.top;

        setDragging(true);
      },
      onDrop: () => {
        ref!.style.opacity = '1';
        ref!.style.pointerEvents = 'auto';
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

  return (
    <div
      ref={ref}
      class={styles.playlistsItem}
      onClick={() => setSelectedPlaylist(props.playlist)}
    >
      <RiEditorDraggable />
      <div class={styles.label}>{props.playlist.name}</div>
    </div>
  );
};
