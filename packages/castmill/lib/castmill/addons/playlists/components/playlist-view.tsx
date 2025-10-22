import {
  JsonPlaylist,
  JsonPlaylistItem,
  JsonWidget,
  JsonWidgetConfig,
  OptionsDict,
} from '@castmill/player';
import {
  Component,
  createEffect,
  createSignal,
  Show,
  onCleanup,
} from 'solid-js';
import { useToast } from '@castmill/ui-common';

import './playlist-view.scss';
import { PlaylistsService } from '../services/playlists.service';
import { WidgetChooser } from './widget-chooser';
import { PlaylistItems } from './playlist-items';
import { PlaylistPreview } from './playlist-preview';
import { AddonStore } from '../../common/interfaces/addon-store';

export const PlaylistView: Component<{
  store: AddonStore;
  playlistId: number;
  organizationId: string;
  baseUrl: string;
  onChange?: (playlist: JsonPlaylist) => void;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const toast = useToast();
  const t = props.t || ((key: string) => key);
  const [widgets, setWidgets] = createSignal<JsonWidget[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [items, setItems] = createSignal<JsonPlaylistItem[]>([]);
  const [playlist, setPlaylist] = createSignal<JsonPlaylist>();

  // Track whether to constrain by width or height based on container size
  const [constrainByWidth, setConstrainByWidth] = createSignal(false);
  const [refReady, setRefReady] = createSignal(false);
  let previewWrapperRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  const [containerReady, setContainerReady] = createSignal(false);
  const [containerHeight, setContainerHeight] = createSignal<number>();

  const updatePlaylistItems = (nextItems: JsonPlaylistItem[]) => {
    setItems(nextItems);
    setPlaylist((prev) => (prev ? { ...prev, items: nextItems } : prev));
  };

  // Setup resize observer to dynamically adjust aspect ratio constraints
  // based on container size (needed for portrait aspect ratios in narrow containers)
  createEffect(() => {
    const pl = playlist();
    const isRefReady = refReady();

    if (!pl || !isRefReady || !previewWrapperRef) return;

    const targetAspectRatio = getCurrentAspectRatio();
    const targetRatio = targetAspectRatio.width / targetAspectRatio.height;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const containerRatio = width / height;

        // If container aspect ratio is narrower than target aspect ratio,
        // constrain by width instead of height to maintain aspect ratio
        setConstrainByWidth(containerRatio < targetRatio);
      }
    });

    resizeObserver.observe(previewWrapperRef);

    onCleanup(() => {
      resizeObserver.disconnect();
    });
  });

  // Track the available height within the modal by calculating modalContent - modalHeader - padding
  createEffect(() => {
    if (!containerReady() || !containerRef) {
      return;
    }

    const modalContent = containerRef.closest(
      '[class*="modalContent"]'
    ) as HTMLElement;
    if (!modalContent) {
      return;
    }

    const updateHeight = () => {
      const modalHeader = modalContent.querySelector(
        '[class*="modalHeader"]'
      ) as HTMLElement;
      if (!modalHeader) {
        return;
      }

      const contentHeight = modalContent.clientHeight;
      const headerHeight = modalHeader.clientHeight;
      const contentStyles = window.getComputedStyle(modalContent);
      const contentPaddingTop = parseFloat(contentStyles.paddingTop);
      const contentPaddingBottom = parseFloat(contentStyles.paddingBottom);

      const availableHeight =
        contentHeight - headerHeight - contentPaddingTop - contentPaddingBottom;

      if (availableHeight > 0) {
        setContainerHeight(availableHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(modalContent);

    const handleWindowResize = () => updateHeight();
    window.addEventListener('resize', handleWindowResize);

    onCleanup(() => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    });
  });

  createEffect(() => {
    (async () => {
      const playlist: JsonPlaylist = await PlaylistsService.getPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId
      );
      setPlaylist(playlist);
      setItems(playlist.items);

      const result = await PlaylistsService.getWidgets(
        props.baseUrl,
        props.organizationId
      );
      setWidgets(result.data);

      setLoading(false);
    })();
  });

  const handleWidgetSearch = async (searchText: string) => {
    const result = await PlaylistsService.getWidgets(
      props.baseUrl,
      props.organizationId,
      searchText
    );
    setWidgets(result.data);
  };

  const onEditItem = async (
    item: JsonPlaylistItem,
    {
      config,
      expandedOptions,
    }: {
      config: Partial<JsonWidgetConfig>;
      expandedOptions: OptionsDict;
    }
  ) => {
    try {
      await PlaylistsService.updateWidgetConfig(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        item.id,
        {
          options: config.options!,
          data: config.data!,
        }
      );

      const newItems = items().map((i) =>
        i.id === item.id
          ? { ...i, config: { ...config, options: expandedOptions } }
          : i
      );

      updatePlaylistItems(newItems as JsonPlaylistItem[]);
    } catch (err) {
      toast.error(`Error updating widget in playlist: ${err}`);
    }
  };

  const resolveWidgetDuration = (widget: JsonWidget, config: OptionsDict) => {
    if (widget.template.type === 'image') {
      return config.duration ? (config.duration as number) * 1000 : 10000;
    }
    return 10000;
  };

  const onInsertItem = async (
    widget: JsonWidget,
    index: number,
    {
      config,
      expandedOptions,
    }: {
      config: Partial<JsonWidgetConfig>;
      expandedOptions: OptionsDict;
    }
  ) => {
    const prevItem = items()[index - 1];
    const duration = resolveWidgetDuration(widget, config.options!);

    try {
      const newItem = await PlaylistsService.insertWidgetIntoPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        {
          widget_id: widget.id!,
          offset: 0,
          duration,
          options: config.options!,
          prev_item_id: prevItem?.id,
        }
      );

      const newItems = [...items()];
      newItems.splice(index ?? 0, 0, {
        id: newItem.id,
        widget,
        duration,
        offset: 0,
        slack: 0,
        name: widget.name,
        config: {
          id: newItem.id,
          widget_id: widget.id!,
          options: expandedOptions,
          data: config.data || {},
        },
      });

      updatePlaylistItems(newItems);
    } catch (err) {
      toast.error(`Error inserting widget into playlist: ${err}`);
    }
  };

  const onMoveItem = async (
    item: JsonPlaylistItem,
    currentIndex: number,
    newIndex: number | undefined
  ) => {
    // Check first if the item has really been moved.
    if (
      typeof newIndex === 'undefined' &&
      currentIndex === items().length - 1
    ) {
      return;
    }

    if (newIndex == currentIndex + 1) {
      return;
    }

    const newItems = [...items()];
    let targetItemId: number | null = null;

    // If new index is undefined then move to the end of the list
    for (;;) {
      if (typeof newIndex === 'undefined') {
        targetItemId = items()[items().length - 1].id ?? null;

        newItems.splice(currentIndex, 1);
        newItems.push(item);
        break;
      }

      if (newIndex === 0) {
        targetItemId = null;
      } else {
        targetItemId = newItems[newIndex - 1].id;
      }

      if (currentIndex > newIndex) {
        newItems.splice(newIndex, 0, item);
        newItems.splice(currentIndex + 1, 1);
        break;
      }

      if (currentIndex < newIndex) {
        newItems.splice(newIndex, 0, item);
        newItems.splice(currentIndex, 1);
        break;
      }
    }

    try {
      await PlaylistsService.moveItemInPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        item.id,
        targetItemId
      );

      updatePlaylistItems(newItems);
    } catch (err) {
      toast.error(`Error moving widget in playlist: ${err}`);
    }
  };

  const onRemoveItem = async (itemToRemove: JsonPlaylistItem) => {
    try {
      await PlaylistsService.removeItemFromPlaylist(
        props.baseUrl,
        props.organizationId,
        props.playlistId,
        itemToRemove.id
      );

      const filteredItems = items().filter((item) => item !== itemToRemove);
      updatePlaylistItems(filteredItems);
    } catch (err) {
      toast.error(`Error removing widget from playlist: ${err}`);
    }
  };

  const onChangeDuration = async (item: JsonPlaylistItem, duration: number) => {
    const newItems = items().map((i) =>
      i.id === item.id ? { ...i, duration } : i
    );
    updatePlaylistItems(newItems);
    await PlaylistsService.updateItemInPlaylist(
      props.baseUrl,
      props.organizationId,
      props.playlistId,
      item.id,
      {
        duration,
      }
    );
  };

  const getCurrentAspectRatio = () => {
    const aspectRatio = playlist()?.settings?.aspect_ratio;
    return {
      width: aspectRatio?.width || 16,
      height: aspectRatio?.height || 9,
    };
  };

  return (
    <Show when={!loading()}>
      <div
        class="playlist-view-container"
        ref={(el) => {
          containerRef = el;
          setContainerReady(true);
        }}
        style={
          containerHeight() ? { height: `${containerHeight()}px` } : undefined
        }
      >
        <div class="playlist-view">
          <div class="playlist-items-wrapper">
            <WidgetChooser widgets={widgets()} onSearch={handleWidgetSearch} />
            <div class="drag-indicator">
              <div class="arrow-container">
                <div class="arrow-line"></div>
                <div class="arrow-head"></div>
              </div>
              <span class="drag-hint">{t('playlists.dragToAdd')}</span>
            </div>
            <PlaylistItems
              store={props.store}
              baseUrl={props.baseUrl}
              organizationId={props.organizationId}
              items={items()}
              onEditItem={onEditItem}
              onInsertItem={onInsertItem}
              onMoveItem={onMoveItem}
              onRemoveItem={onRemoveItem}
              onChangeDuration={onChangeDuration}
            />
          </div>

          <div
            ref={(el) => {
              previewWrapperRef = el;
              setRefReady(true);
            }}
            class="playlist-preview-wrapper"
            classList={{
              'constrain-by-width': constrainByWidth(),
            }}
          >
            <div
              class="playlist-preview"
              style={{
                'aspect-ratio': `${getCurrentAspectRatio().width} / ${
                  getCurrentAspectRatio().height
                }`,
              }}
            >
              <PlaylistPreview playlist={playlist()!} />
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
