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
import { useToast, Modal, Button } from '@castmill/ui-common';

import './playlist-view.scss';
import { PlaylistsService } from '../services/playlists.service';
import { WidgetChooser } from './widget-chooser';
import { PlaylistItems, CredentialsError } from './playlist-items';
import {
  PlaylistPreview,
  PlaylistPreviewRef,
  LayerOffset,
} from './playlist-preview';
import { AddonStore } from '../../common/interfaces/addon-store';

/**
 * Extracts default values from a data_schema to use as initial data when adding a widget.
 * This ensures widgets with dynamic content (like scrollers with items) render properly
 * before integration data is fetched.
 */
function getDefaultDataFromSchema(
  dataSchema: Record<string, any> | undefined
): Record<string, any> {
  if (!dataSchema) return {};

  const defaults: Record<string, any> = {};

  for (const [key, schema] of Object.entries(dataSchema)) {
    if (typeof schema === 'object' && schema !== null && 'default' in schema) {
      defaults[key] = schema.default;
    } else if (typeof schema === 'string') {
      // Simple type without default - provide sensible placeholder
      switch (schema) {
        case 'string':
          defaults[key] = '';
          break;
        case 'number':
          defaults[key] = 0;
          break;
        case 'boolean':
          defaults[key] = false;
          break;
      }
    }
  }

  return defaults;
}

export const PlaylistView: Component<{
  store: AddonStore;
  playlistId: number;
  organizationId: string;
  baseUrl: string;
  onChange?: (playlist: JsonPlaylist) => void;
  onNavigateAway?: () => void;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const toast = useToast();
  const t = props.t || ((key: string) => key);
  const [widgets, setWidgets] = createSignal<JsonWidget[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [items, setItems] = createSignal<JsonPlaylistItem[]>([]);
  const [playlist, setPlaylist] = createSignal<JsonPlaylist>();
  const [credentialsError, setCredentialsError] =
    createSignal<CredentialsError | null>(null);
  const [dynamicDurations, setDynamicDurations] = createSignal<
    Record<number, number>
  >({});

  // Track whether to constrain by width or height based on container size
  const [constrainByWidth, setConstrainByWidth] = createSignal(false);
  const [refReady, setRefReady] = createSignal(false);
  let previewWrapperRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  const [containerReady, setContainerReady] = createSignal(false);
  const [containerHeight, setContainerHeight] = createSignal<number>();

  // Store reference to playlist preview for seeking
  let previewRef: PlaylistPreviewRef | null = null;
  let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const updatePlaylistItems = (nextItems: JsonPlaylistItem[]) => {
    setItems(nextItems);
    setPlaylist((prev) => (prev ? { ...prev, items: nextItems } : prev));
  };

  // Handle credentials error from widget insertion
  const handleCredentialsError = (error: CredentialsError) => {
    setCredentialsError(error);
  };

  // Navigate to widget integrations page
  const goToWidgetIntegrations = () => {
    const error = credentialsError();
    if (error?.widget?.id) {
      // Close the credentials error modal first
      setCredentialsError(null);

      // Close the parent playlist modal before navigating
      props.onNavigateAway?.();

      // Navigate to the widgets addon with widget ID in path (RESTful)
      // URL pattern: /org/:orgId/content/widgets/:widgetId?tab=integrations
      const url = `/org/${props.organizationId}/content/widgets/${error.widget.id}?tab=integrations`;

      // Use soft navigation if available, otherwise fall back to hard redirect
      if (props.store.router?.navigate) {
        props.store.router.navigate(url);
      } else {
        window.location.href = url;
      }
    }
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

  const handleLayerOffsets = (offsets: LayerOffset[]) => {
    if (!offsets || offsets.length === 0) {
      setDynamicDurations({});
      return;
    }

    const durationMap: Record<number, number> = {};
    const currentItems = items();

    currentItems.forEach((item, index) => {
      if (!item?.id) {
        return;
      }

      if (typeof item.duration === 'number' && item.duration > 0) {
        return;
      }

      const runtime = offsets[index]?.duration;
      if (typeof runtime === 'number' && runtime > 0) {
        durationMap[item.id] = runtime;
      }
    });

    setDynamicDurations(durationMap);
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
      // Recalculate duration based on updated options
      const newDuration = resolveWidgetDuration(item.widget, expandedOptions);

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

      // If duration changed, update it on the server
      if (newDuration !== item.duration) {
        await PlaylistsService.updateItemInPlaylist(
          props.baseUrl,
          props.organizationId,
          props.playlistId,
          item.id,
          { duration: newDuration }
        );
      }

      // Fetch integration data for the updated widget config
      // This triggers on-demand fetch with the new options and returns fresh data
      const widgetConfigId = item.config.id;
      const integrationData = widgetConfigId
        ? await PlaylistsService.fetchWidgetConfigData(
            props.baseUrl,
            widgetConfigId
          )
        : null;

      const newItems = items().map((i) =>
        i.id === item.id
          ? {
              ...i,
              duration: newDuration,
              config: {
                ...config,
                options: expandedOptions,
                data: integrationData || config.data || {},
              },
            }
          : i
      );

      updatePlaylistItems(newItems as JsonPlaylistItem[]);
    } catch (err) {
      toast.error(`Error updating widget in playlist: ${err}`);
    }
  };

  /**
   * Recursively check if a template contains a component with dynamic duration
   * (video, scroller, layout, or paginated-list). These components determine their duration at runtime
   * based on content (video length, scroll distance/speed, contained playlists, or page count).
   */
  const containsDynamicDurationComponent = (template: any): boolean => {
    if (!template) return false;

    const type = template.type;
    // Layout, video, scroller, and paginated-list all have dynamic durations determined at runtime
    if (
      type === 'video' ||
      type === 'scroller' ||
      type === 'layout' ||
      type === 'paginated-list'
    ) {
      return true;
    }

    // Check nested components array (for group, layout, etc.)
    if (template.components && Array.isArray(template.components)) {
      return template.components.some(containsDynamicDurationComponent);
    }

    // Check single nested component (for scroller's item template)
    if (template.component) {
      return containsDynamicDurationComponent(template.component);
    }

    return false;
  };

  const resolveWidgetDuration = (widget: JsonWidget, config: OptionsDict) => {
    // Check for explicit duration settings in config options
    // Common duration option names: duration, display_duration
    const durationFromConfig =
      config.duration ?? config.display_duration ?? null;

    if (durationFromConfig !== null && typeof durationFromConfig === 'number') {
      return durationFromConfig * 1000; // Convert seconds to ms
    }

    if (widget.template.type === 'image') {
      return 10000;
    }

    // For widgets containing video or scroller components, use duration 0
    // to indicate the player should use the actual dynamic duration.
    // The Layer class will fall back to widget.duration() when _duration is 0.
    if (containsDynamicDurationComponent(widget.template)) {
      return 0;
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
    // Use expandedOptions which includes default values from the schema
    const duration = resolveWidgetDuration(widget, expandedOptions);

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

      // Fetch integration data for the new widget config
      // This triggers on-demand fetch if needed and returns cached/fresh data
      const integrationData = await PlaylistsService.fetchWidgetConfigData(
        props.baseUrl,
        newItem.widget_config_id
      );

      // Use integration data if available, otherwise fall back to default data from schema
      // This ensures widgets like scrollers have data to render before integration fetches complete
      const defaultData = getDefaultDataFromSchema(widget.data_schema);
      const widgetData = integrationData || config.data || defaultData;

      const newItems = [...items()];
      newItems.splice(index ?? 0, 0, {
        id: newItem.id,
        widget,
        duration,
        offset: 0,
        slack: 0,
        name: widget.name,
        config: {
          id: newItem.widget_config_id, // Use the widget_config_id from the server
          widget_id: widget.id!,
          options: expandedOptions,
          data: widgetData,
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

  // Calculate offset for a given item index and seek to it (debounced)
  const seekToItem = (index: number) => {
    // Clear any pending seek
    if (seekDebounceTimer) {
      clearTimeout(seekDebounceTimer);
    }

    // Debounce seeks to avoid queuing
    seekDebounceTimer = setTimeout(() => {
      if (!previewRef) {
        return;
      }

      const currentItems = items();
      if (index < 0 || index >= currentItems.length) {
        return;
      }

      // Get the real offsets from the player (calculated from actual layer durations)
      const layerOffsets = previewRef.getLayerOffsets();

      if (index < layerOffsets.length) {
        const offset = layerOffsets[index].start;
        previewRef.seek(offset);
      }
    }, 100); // 100ms debounce
  };

  onCleanup(() => {
    if (seekDebounceTimer) {
      clearTimeout(seekDebounceTimer);
      seekDebounceTimer = null;
    }
  });

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
            <WidgetChooser
              widgets={widgets()}
              baseUrl={props.baseUrl}
              onSearch={handleWidgetSearch}
            />
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
              playlistId={props.playlistId}
              items={items()}
              dynamicDurations={dynamicDurations()}
              onEditItem={onEditItem}
              onInsertItem={onInsertItem}
              onMoveItem={onMoveItem}
              onRemoveItem={onRemoveItem}
              onChangeDuration={onChangeDuration}
              onCredentialsError={handleCredentialsError}
              onSeekToItem={seekToItem}
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
              <PlaylistPreview
                playlist={playlist()!}
                onReady={async (ref) => {
                  previewRef = ref;
                  // Prime all layers to calculate their actual durations
                  const offsets = await ref.primeAllLayers();
                  handleLayerOffsets(offsets);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Credentials Error Modal */}
      <Show when={credentialsError()}>
        <Modal
          title={t('playlists.credentialsRequired')}
          description={t('playlists.credentialsRequiredDescription', {
            widget: credentialsError()?.widget?.name || t('common.widget'),
          })}
          onClose={() => setCredentialsError(null)}
        >
          <div
            style={{ display: 'flex', 'flex-direction': 'column', gap: '1em' }}
          >
            <p style={{ margin: 0 }}>
              {t('playlists.missingIntegrations')}:{' '}
              <strong>
                {credentialsError()?.missingIntegrations?.join(', ')}
              </strong>
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.5em',
                'justify-content': 'flex-end',
              }}
            >
              <Button
                label={t('common.cancel')}
                color="secondary"
                onClick={() => setCredentialsError(null)}
              />
              <Button
                label={t('playlists.goToIntegrations')}
                onClick={goToWidgetIntegrations}
              />
            </div>
          </div>
        </Modal>
      </Show>
    </Show>
  );
};
