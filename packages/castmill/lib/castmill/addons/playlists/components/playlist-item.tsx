import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview';

import { debounce } from 'lodash';

import { IconWrapper, Slider, formatDuration } from '@castmill/ui-common';
import { RiEditorDraggable } from 'solid-icons/ri';
import { AiOutlineEdit, AiOutlineWarning } from 'solid-icons/ai';
import { BsTrash3 } from 'solid-icons/bs';

import { DEFAULT_WIDGET_ICON } from '../../common/constants';
import { isImageIcon, getIconUrl } from '../utils/icon-utils';
import { hasDynamicDuration } from '../utils/duration-utils';
import styles from './playlist-item.module.scss';

import { Component, onMount, createSignal, onCleanup, Show } from 'solid-js';
import { JsonPlaylistItem } from '@castmill/player';

// get thumbnail uri from playlist item
const getThumbnailUri = (item: JsonPlaylistItem) => {
  // TODO improve typing
  const image = item.config.options.image as any;
  const video = item.config.options.video as any;

  // Return video thumbnail if available, otherwise image thumbnail
  return video?.files?.thumbnail?.uri || image?.files?.thumbnail?.uri;
};

// get widget name from playlist item (used as title)
const getWidgetName = (item: JsonPlaylistItem) => item.widget.name;

// Regex for matching hex color values
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

// Keywords that indicate a color-related option key
const COLOR_KEYWORDS = [
  'color',
  'background',
  'bg',
  'fill',
  'stroke',
  'border',
];

/**
 * Checks if a value looks like a hex color (#RGB, #RRGGBB, or #RRGGBBAA)
 */
export const isColorValue = (value: string): boolean => {
  return HEX_COLOR_REGEX.test(value);
};

/**
 * Checks if a key name suggests it's for a color option
 */
export const isColorKey = (key: string): boolean => {
  const lowerKey = key.toLowerCase();
  return COLOR_KEYWORDS.some((keyword) => lowerKey.includes(keyword));
};

/**
 * Extracts a display-friendly name from a URL (hostname without www)
 */
export const getUrlDisplayName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
  }
};

// get subtitle from playlist item options
// This function automatically extracts a meaningful subtitle from widget options
const getWidgetSubtitle = (item: JsonPlaylistItem): string | null => {
  const options = item.config.options;
  const schema = item.widget.options_schema;
  const widgetSlug = item.widget.slug;

  if (!options || Object.keys(options).length === 0) {
    return null;
  }

  // Special handling for layout-widget: show aspect ratio and zone count
  if (widgetSlug === 'layout-widget') {
    const layoutRef = options.layoutRef as any;
    if (layoutRef) {
      const parts: string[] = [];
      if (layoutRef.aspectRatio) {
        parts.push(layoutRef.aspectRatio);
      }
      if (layoutRef?.zones?.zones) {
        const zoneCount = layoutRef.zones.zones.length;
        parts.push(`${zoneCount} zone${zoneCount !== 1 ? 's' : ''}`);
      }
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    return null;
  }

  // Special handling for stock-ticker: show symbols
  if (widgetSlug === 'stock-ticker' && options.symbols) {
    const symbols = options.symbols as string;
    return symbols.length > 40 ? symbols.substring(0, 37) + '...' : symbols;
  }

  // Special handling for RSS/feed widgets: show feed URL domain
  if (options.feed_url && typeof options.feed_url === 'string') {
    return getUrlDisplayName(options.feed_url);
  }

  // Priority 1: Check for media references (image, video, etc.) and use their names
  if (schema) {
    for (const [key, schemaField] of Object.entries(schema)) {
      const field = schemaField as any;
      if (field.type === 'ref' && options[key]) {
        const ref = options[key] as any;
        // Check if it's a media reference with a name
        if (ref?.name) {
          return ref.name;
        }
      }
    }
  }

  // Priority 2: Look for common field names that would make good subtitles
  const priorityFields = [
    'title',
    'name',
    'text',
    'label',
    'heading',
    'description',
    'message',
    'content',
    'url',
    'symbols',
  ];

  for (const field of priorityFields) {
    if (options[field] && typeof options[field] === 'string') {
      const value = options[field] as string;
      // Skip color values
      if (isColorValue(value)) continue;
      // For URL fields, show just the domain
      if (field === 'url') {
        return getUrlDisplayName(value);
      }
      // Truncate if too long
      return value.length > 40 ? value.substring(0, 37) + '...' : value;
    }
  }

  // Priority 3: Use the first non-color string value we find
  for (const [key, value] of Object.entries(options)) {
    // Skip color-related keys
    if (isColorKey(key)) continue;

    if (typeof value === 'string' && value.trim().length > 0) {
      const stringValue = value.trim();
      // Skip color values
      if (isColorValue(stringValue)) continue;
      return stringValue.length > 40
        ? stringValue.substring(0, 37) + '...'
        : stringValue;
    }
  }

  return null;
};

const Thumbnail: Component<{
  item: JsonPlaylistItem;
  baseUrl: string;
}> = (props) => {
  const thumbnailUri = getThumbnailUri(props.item);
  const widgetName = getWidgetName(props.item);
  const widgetSubtitle = getWidgetSubtitle(props.item);
  const widgetIcon = props.item.widget.icon;
  const iconUrl = getIconUrl(widgetIcon, props.baseUrl);
  const integrationError = () => props.item.integration_error;

  return (
    <div class={styles.thumbnailContainer}>
      <Show
        when={thumbnailUri}
        fallback={
          <div class={styles.widgetIconContainer}>
            <Show
              when={isImageIcon(iconUrl)}
              fallback={
                <span class={styles.iconSymbol}>
                  {widgetIcon || DEFAULT_WIDGET_ICON}
                </span>
              }
            >
              <img
                draggable={false}
                src={iconUrl}
                alt={widgetName}
                class={styles.iconImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = document.createTextNode(DEFAULT_WIDGET_ICON);
                  e.target.parentNode?.appendChild(fallback);
                }}
              />
            </Show>
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
      <div class={styles.widgetInfo}>
        <div class={styles.widgetTitle}>{widgetName}</div>
        <Show when={widgetSubtitle && !integrationError()}>
          <div class={styles.widgetSubtitle}>{widgetSubtitle}</div>
        </Show>
        <Show when={integrationError()}>
          <div class={styles.integrationError} title={integrationError()}>
            <IconWrapper icon={AiOutlineWarning} />
            <span>{integrationError()}</span>
          </div>
        </Show>
      </div>
    </div>
  );
};

export const PlaylistItem: Component<{
  item: JsonPlaylistItem;
  index: number;
  baseUrl: string;
  dynamicDuration?: number;
  onEdit: () => void;
  onRemove: (item: JsonPlaylistItem) => void;
  onChangeDuration: (item: JsonPlaylistItem, duration: number) => void;
  onDragStart: () => void;
  onClick?: () => void;
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

  const isDynamicDuration = () => hasDynamicDuration(props.item);

  const resolvedDuration = () => {
    if (typeof props.item.duration === 'number' && props.item.duration > 0) {
      return props.item.duration;
    }

    if (
      typeof props.dynamicDuration === 'number' &&
      props.dynamicDuration > 0
    ) {
      return props.dynamicDuration;
    }

    return 0;
  };

  const readableDuration = () => {
    const duration = resolvedDuration();
    // For dynamic duration widgets, show "Auto" while waiting for actual duration
    if (duration === 0 && isDynamicDuration()) {
      return 'Auto';
    }
    return formatDuration(duration);
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
        <div ref={handleRef} class={styles.playlistItemDragHandle}>
          <IconWrapper icon={RiEditorDraggable} />
          <div
            onClick={(e) => {
              // Only trigger onClick if not dragging
              if (!isDragging()) {
                e.stopPropagation();
                props.onClick?.();
              }
            }}
            style={{ cursor: props.onClick ? 'pointer' : 'default' }}
          >
            <Thumbnail item={props.item} baseUrl={props.baseUrl} />
          </div>
        </div>
        <div class={styles.playlistItemDuration}>
          <Show
            when={!isDynamicDuration()}
            fallback={
              <div class={styles.autoDuration}>
                <span class={styles.autoDurationLabel}>Duration</span>
                <span class={styles.autoDurationValue}>
                  {readableDuration()}
                </span>
              </div>
            }
          >
            <Slider
              name="Duration"
              value={props.item.duration || 10000}
              min={1000}
              max={Math.max(60000, props.item.duration || 10000)}
              step={1000}
              onSlideStop={handleDurationChange}
              formatValue={formatDuration}
            />
          </Show>
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
