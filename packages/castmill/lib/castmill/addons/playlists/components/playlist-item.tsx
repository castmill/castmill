import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

import { IconWrapper } from '@castmill/ui-common';
import { RiEditorDraggable } from 'solid-icons/ri';
import { AiOutlineEdit } from 'solid-icons/ai';
import { BsTrash3 } from 'solid-icons/bs';

import styles from './playlist-item.module.scss';

import {
  Component,
  onMount,
  createSignal,
  onCleanup,
} from 'solid-js';
import { JsonPlaylistItem } from '@castmill/player';

export const PlaylistItem: Component<{
  item: JsonPlaylistItem;
  index: number;
  onEdit: () => void;
  onRemove: (item: JsonPlaylistItem) => void;
  onDragStart: () => void;
  animate: boolean;
}> = (props) => {
  let itemRef: HTMLDivElement | undefined = undefined;
  let draggingRef: HTMLDivElement | undefined = undefined;

  const [isDragging, setIsDragging] = createSignal(false);
  const [animationEnabled, setAnimationEnabled] = createSignal(true);
  const [isDraggedOver, setIsDraggedOver] = createSignal(false);

  onMount(() => {
    if (itemRef) {
      const cleanupDrop = dropTargetForElements({
        element: itemRef!,
        getData: () => ({ index: props.index }),
        onDragEnter({ source }) {
          if (source.data.index !== props.index) {
            setIsDraggedOver(true);
          }
          setAnimationEnabled(true);
        },
        onDragLeave() {
          setIsDraggedOver(false);
        },
        onDrop: (args) => {
          setIsDraggedOver(false);
          setAnimationEnabled(false);
        },
      });

      onCleanup(() => {
        cleanupDrop();
      });
    }

    if (draggingRef) {
      const cleanupDrag = draggable({
        element: draggingRef,
        getInitialData: () => ({
          item: props.item,
          index: props.index,
        }),
        onDragStart: () => {
          setIsDragging(true);
          setAnimationEnabled(false);
          props.onDragStart();
        },
        onDrop: () => setIsDragging(false),
      });

      onCleanup(() => {
        cleanupDrag();
      });
    }
  });

  const handleRemove = () => {
    props.onRemove(props.item);
  };

  const wrapperClasses = () => {
    return `${styles.playlistItemWrapper} ${isDraggedOver() ? styles.draggedOver : ''}`;
  };

  return (
    <div
      ref={itemRef}
      class={wrapperClasses()}
      style={{ display: isDragging() ? 'none' : 'block' }}
    >
      <div
        class={`item-placeholder ${animationEnabled() && props.animate ? 'animate' : ''}`}
        style={{ height: isDraggedOver() ? '6em' : '1em' }}
      ></div>
      <div ref={draggingRef} class={styles.playlistItem}>
        <div class={styles.playlistItemDragHandle}>
          <IconWrapper icon={RiEditorDraggable} />
        </div>
        <div class={styles.playlistItemName}>{props.item.widget.name}</div>
        <div class={styles.playlistItemDuration}>
          Duration slider {props.item.duration}
        </div>
        <div class={styles.playlistItemActions}>
          <div class={styles.playlistItemEditIcon}>
            <button onClick={() => props.onEdit()}>
              <IconWrapper icon={AiOutlineEdit} />
            </button>
          </div>
          <div class={styles.playlistItemRemoveIcon}>
            <button onClick={handleRemove}>
              <IconWrapper icon={BsTrash3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
