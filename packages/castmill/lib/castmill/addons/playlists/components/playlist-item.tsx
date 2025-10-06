import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview';

import { debounce } from 'lodash';

import { IconWrapper, Slider, formatDuration } from '@castmill/ui-common';
import { RiEditorDraggable } from 'solid-icons/ri';
import { AiOutlineEdit } from 'solid-icons/ai';
import { BsTrash3 } from 'solid-icons/bs';

import { DEFAULT_WIDGET_ICON } from '../../common/constants';
import styles from './playlist-item.module.scss';

import { Component, onMount, createSignal, onCleanup, Show } from 'solid-js';
import { JsonPlaylistItem } from '@castmill/player';

// get thumbnail uri from playlist item
const getThumbnailUri = (item: JsonPlaylistItem) => {
  // TODO improve typing
  // TODO thumbnails for other widget types
  const image = item.config.options.image as any;
  return image?.files?.thumbnail?.uri;
};

// get widget name from playlist item
const getWidgetName = (item: JsonPlaylistItem) => item.widget.name;

const Thumbnail: Component<{
  item: JsonPlaylistItem;
}> = (props) => {
  const thumbnailUri = getThumbnailUri(props.item);
  const widgetName = getWidgetName(props.item);
  const widgetIcon = props.item.widget.icon;

  const isImageIcon =
    widgetIcon &&
    (widgetIcon.startsWith('data:image/') ||
      widgetIcon.startsWith('http://') ||
      widgetIcon.startsWith('https://') ||
      widgetIcon.startsWith('/'));

  return (
    <Show
      when={thumbnailUri}
      fallback={
        <div class={styles.widgetIcon}>
          <Show
            when={isImageIcon}
            fallback={<span>{widgetIcon || DEFAULT_WIDGET_ICON}</span>}
          >
            <img
              draggable={false}
              src={widgetIcon}
              alt={widgetName}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const fallback = document.createTextNode(DEFAULT_WIDGET_ICON);
                e.target.parentNode?.appendChild(fallback);
              }}
            />
          </Show>
          <span class={styles.widgetName}>{widgetName}</span>
        </div>
      }
    >
      <div class={styles.thumbnailWrapper}>
        <img
          draggable={false}
          src={thumbnailUri}
          class={styles.thumbnailImage}
        />
      </div>
    </Show>
  );
};

export const PlaylistItem: Component<{
  item: JsonPlaylistItem;
  index: number;
  onEdit: () => void;
  onRemove: (item: JsonPlaylistItem) => void;
  onChangeDuration: (item: JsonPlaylistItem, duration: number) => void;
  onDragStart: () => void;
  animate: boolean;
}> = (props) => {
  let itemRef: HTMLDivElement | undefined = undefined;
  let draggingRef: HTMLDivElement | undefined = undefined;
  let handleRef: HTMLDivElement | undefined = undefined;

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

    if (draggingRef && handleRef) {
      const cleanupDrag = draggable({
        element: draggingRef,
        dragHandle: handleRef,
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

  const handleDurationChange = debounce((value: number) => {
    props.onChangeDuration(props.item, value);
  }, 500);

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
        <div ref={handleRef} class={styles.playlistItemDragHandle}>
          <IconWrapper icon={RiEditorDraggable} />
          <Thumbnail item={props.item} />
        </div>
        <div class={styles.playlistItemDuration}>
          <Slider
            name="Duration"
            value={props.item.duration}
            min={1000}
            max={Math.max(60000, props.item.duration)}
            step={1000}
            onSlideStop={handleDurationChange}
            formatValue={formatDuration}
          />
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
