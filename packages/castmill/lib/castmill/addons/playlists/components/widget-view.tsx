import {
  Component,
  onMount,
  createEffect,
  onCleanup,
  createSignal,
  createMemo,
} from 'solid-js';
import { Socket, Channel } from 'phoenix';

import {
  Playlist,
  PlayerUI,
  PlayerUIControls,
  JsonPlaylistItem,
  JsonPlaylist,
  JsonWidgetConfig,
  JsonWidget,
  OptionsDict,
  parseAspectRatio,
} from '@castmill/player';
import { ResourceManager, Cache, StorageDummy } from '@castmill/cache';

import styles from './widget-view.module.scss';
import { safeStringify } from './utils';

interface WidgetViewProps {
  widget: JsonWidget;
  config: JsonWidgetConfig;
  options: OptionsDict;
  baseUrl?: string;
  socket?: Socket;
}

/**
 * Extracts default values from a data_schema to use as placeholder data for preview.
 * This allows widgets with integration data (like Spotify) to render in preview mode.
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

export const WidgetView: Component<WidgetViewProps> = (props) => {
  const cache = new Cache(
    new StorageDummy('widget-editor'),
    'widget-editor-cache',
    100
  );
  const resourceManager = new ResourceManager(cache);

  let controls: PlayerUIControls;
  let playerUI: PlayerUI;
  let notificationChannel: Channel | null = null;
  let integrationUpdateRef: number | null = null;
  let containerRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  // Signal for calculated dimensions based on container and aspect ratio
  const [containerSize, setContainerSize] = createSignal<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // Signal to store integration data
  const [integrationData, setIntegrationData] = createSignal<Record<
    string,
    any
  > | null>(null);
  // Start with dataLoaded=true so preview renders immediately with defaults
  // The fetch effect will set it to false only when actually fetching
  const [dataLoaded, setDataLoaded] = createSignal(true);

  // Track the current seek position to restore it when options change
  // Start at 0 on first render; user can manually seek to skip intro animations
  let currentSeekPosition = 0;
  let isFirstRender = true;

  // Fetch integration data if widget config has an ID
  const fetchIntegrationData = async () => {
    if (props.config.id && props.baseUrl) {
      try {
        const url = `${props.baseUrl}/dashboard/widget-configs/${props.config.id}/data`;
        const response = await fetch(url, { credentials: 'include' });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            setIntegrationData(result.data);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch integration data:', error);
      }
    }
    setDataLoaded(true);
  };

  // Subscribe to real-time widget config data updates via the notifications channel.
  // Security: Users only receive updates for organizations they belong to,
  // as they only subscribe to organization channels they're members of.
  const subscribeToWidgetConfigUpdates = () => {
    if (!props.socket) {
      return;
    }

    // Get channels from the socket - the notifications channel should already be joined
    const channels = (props.socket as any).channels as Channel[];
    notificationChannel =
      channels?.find((ch: Channel) => ch.topic.startsWith('notifications:')) ||
      null;

    if (!notificationChannel) {
      return;
    }

    // Listen for widget config data updates and store the ref for cleanup
    integrationUpdateRef = notificationChannel.on(
      'widget_config_data_update',
      (payload: {
        type: string;
        widget_id: string;
        integration_id: number;
        discriminator_id: string;
        data: Record<string, any>;
        updated_at: string;
      }) => {
        // Check if this update is for our widget type
        // widget_id in payload is a string, props.widget.id is a number
        if (payload.widget_id === String(props.widget.id)) {
          setIntegrationData(payload.data);
        }
      }
    );
  };

  onMount(async () => {
    await cache.init();
    subscribeToWidgetConfigUpdates();
  });

  // Fetch integration data reactively when config changes
  // This ensures data is fetched:
  // 1. On initial mount when config.id is available
  // 2. When a new widget is added and receives its widget_config_id
  // 3. When config.options change after a save (affects the discriminator)
  createEffect(() => {
    // Track these props for reactivity - accessing them inside the effect
    // ensures SolidJS tracks them as dependencies
    const configId = props.config.id;
    const configOptions = props.config.options;

    // Only set loading state if we have something to fetch
    // For new widgets without an ID, we skip fetching and use defaults
    if (configId && props.baseUrl) {
      setDataLoaded(false);
    }

    // Trigger async fetch (will be a no-op if no configId)
    (async () => {
      await fetchIntegrationData();
    })();
  });

  createEffect(() => {
    // Wait until data loading is complete
    if (!dataLoaded()) return;

    // IMPORTANT: Explicitly access these props at the top level for proper
    // SolidJS dependency tracking. Accessing them inside nested objects or
    // spreads may not register them as dependencies.
    const currentWidget = props.widget;
    const currentConfig = props.config;
    const currentOptions = props.options;

    // Force SolidJS to track deep changes in options by serializing
    // This ensures the effect re-runs when any nested property changes
    // (e.g., when a playlist reference is selected in a Layout widget)
    const _optionsFingerprint = safeStringify(currentOptions);

    // Generate default data from data_schema for preview mode
    const defaultData = getDefaultDataFromSchema(currentWidget.data_schema);

    // Priority: integration data > config data > default data
    const integration = integrationData();
    const configData =
      currentConfig.data && Object.keys(currentConfig.data).length > 0
        ? currentConfig.data
        : null;
    const effectiveData = integration || configData || defaultData;

    // Calculate duration from options (supports 'duration' or 'display_duration')
    // Convert from seconds to milliseconds, default to 10 seconds
    const durationFromOptions =
      currentOptions.duration ?? currentOptions.display_duration ?? null;
    const previewDuration =
      typeof durationFromOptions === 'number' ? durationFromOptions * 1000 : 0;

    const dummyJsonPlaylistItem: JsonPlaylistItem = {
      id: 123, // Dummy ID
      duration: previewDuration, // Use duration from options, or let widget determine it
      offset: 0, // Dummy offset
      widget: currentWidget,
      slack: 0, // No slack for preview
      name: 'widget-layer', // Dummy name
      config: {
        ...currentConfig,
        options: currentOptions,
        data: effectiveData,
      },
    };

    const jsonPlaylist: JsonPlaylist = {
      id: 123, // Dummy ID
      name: 'widget-playlist', // Dummy name
      items: [dummyJsonPlaylistItem],
      status: 'live',
    };

    const playlist = Playlist.fromJSON(jsonPlaylist, resourceManager);

    // Preserve current playback position before swapping instances
    // Use controls.seek (slider value) as it's more reliable than playerUI.position
    if (controls) {
      const sliderValue = controls.seek;
      if (typeof sliderValue === 'number' && sliderValue > 0) {
        currentSeekPosition = sliderValue;
      }
    }

    const previousPlayerUI = playerUI;
    const previousControls = controls;

    controls = new PlayerUIControls('controls-widget', {
      position: {
        bottom: '0',
      },
    });

    // On first render start at 0; on subsequent renders (option edits) restore saved position
    const initialPosition = isFirstRender ? 0 : currentSeekPosition;
    isFirstRender = false;

    playerUI = new PlayerUI('player-widget', playlist, {
      controls,
      controlsMaster: true,
      initialSeekPosition: initialPosition,
    });

    // After seek completes, clean up old instances
    playerUI.seek(initialPosition).subscribe({
      complete: () => {
        previousPlayerUI?.destroy();
        previousControls?.destroy();
      },
      error: () => {
        previousPlayerUI?.destroy();
        previousControls?.destroy();
      },
    });
  });

  onCleanup(() => {
    // Remove widget config data update listener
    if (notificationChannel && integrationUpdateRef !== null) {
      notificationChannel.off(
        'widget_config_data_update',
        integrationUpdateRef
      );
    }

    if (playerUI) {
      playerUI.destroy();
    }

    if (controls) {
      controls.destroy();
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  // Get the effective aspect ratio from options or widget definition
  const getEffectiveAspectRatio = (): number => {
    // Check all options for any that might be a layout-ref value with aspectRatio
    // This handles widgets where the layout-ref field may have any key name
    if (props.options) {
      for (const value of Object.values(props.options)) {
        if (
          value &&
          typeof value === 'object' &&
          'aspectRatio' in value &&
          'layoutId' in value
        ) {
          // This looks like a LayoutRefValue
          const ratio = parseAspectRatio(
            (value as { aspectRatio: string }).aspectRatio
          );
          if (ratio) return ratio;
        }
      }
    }

    // Fall back to widget's own aspect ratio, default to 1:1
    return parseAspectRatio(props.widget.aspect_ratio) || 1;
  };

  // Calculate dimensions to fit within container while maintaining aspect ratio (contain behavior)
  const calculateContainDimensions = (
    containerWidth: number,
    containerHeight: number,
    aspectRatio: number
  ) => {
    const containerAspect = containerWidth / containerHeight;

    if (aspectRatio > containerAspect) {
      // Width-constrained: content is wider relative to container
      return {
        width: containerWidth,
        height: containerWidth / aspectRatio,
      };
    } else {
      // Height-constrained: content is taller relative to container
      return {
        width: containerHeight * aspectRatio,
        height: containerHeight,
      };
    }
  };

  // Helper to update container size from parent
  const updateContainerSize = () => {
    const parent = containerRef?.parentElement;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      const paddingX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = parentRect.width - paddingX;
      const availableHeight = parentRect.height - paddingY;

      if (availableWidth > 0 && availableHeight > 0) {
        setContainerSize({ width: availableWidth, height: availableHeight });
      }
    }
  };

  // Set up ResizeObserver to track parent container size
  onMount(() => {
    // Schedule for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (containerRef?.parentElement) {
        resizeObserver = new ResizeObserver(() => {
          updateContainerSize();
        });
        resizeObserver.observe(containerRef.parentElement);
        updateContainerSize(); // Initial measurement
      }
    });
  });

  // Calculate container style based on aspect ratio and available space
  // This is reactive to both containerSize and props.options changes
  const containerStyle = createMemo(() => {
    const size = containerSize();
    const aspectRatio = getEffectiveAspectRatio();

    if (size.width > 0 && size.height > 0) {
      const dims = calculateContainDimensions(
        size.width,
        size.height,
        aspectRatio
      );
      return {
        width: `${dims.width}px`,
        height: `${dims.height}px`,
      };
    }

    // Fallback to CSS aspect-ratio if parent dimensions not yet available
    return { 'aspect-ratio': `${aspectRatio}`, width: '100%', height: 'auto' };
  });

  return (
    <div ref={containerRef} class={styles.widgetView} style={containerStyle()}>
      <div id="player-widget" class={styles.widgetPlayer}></div>
      <div id="controls-widget" class={styles.widgetControls}></div>
    </div>
  );
};
