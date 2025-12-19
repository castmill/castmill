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

  // Signal to store integration data
  const [integrationData, setIntegrationData] = createSignal<Record<
    string,
    any
  > | null>(null);
  const [dataLoaded, setDataLoaded] = createSignal(false);

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
        if (payload.widget_id === props.widget.id) {
          setIntegrationData(payload.data);
        }
      }
    );
  };

  onMount(async () => {
    await cache.init();
    await fetchIntegrationData();
    subscribeToWidgetConfigUpdates();
  });

  createEffect(() => {
    // Wait until data loading is complete
    if (!dataLoaded()) return;

    // Generate default data from data_schema for preview mode
    const defaultData = getDefaultDataFromSchema(props.widget.data_schema);

    // Priority: integration data > config data > default data
    const integration = integrationData();
    const configData =
      props.config.data && Object.keys(props.config.data).length > 0
        ? props.config.data
        : null;
    const effectiveData = integration || configData || defaultData;

    const dummyJsonPlaylistItem: JsonPlaylistItem = {
      id: 123, // Dummy ID
      duration: 10000, // Dummy duration
      offset: 0, // Dummy offset
      widget: props.widget,
      slack: 1000, // Dummy slack
      name: 'widget-layer', // Dummy name
      config: {
        ...props.config,
        options: props.options,
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

    if (controls) {
      controls.destroy();
    }

    controls = new PlayerUIControls('controls-widget', {
      position: {
        bottom: '4em',
      },
    });

    if (playerUI) {
      playerUI.destroy();
    }

    playerUI = new PlayerUI('player-widget', playlist, {
      controls,
      controlsMaster: true,
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
  });

  // Calculate container style based on widget's aspect ratio
  const containerStyle = createMemo(() => {
    const ratio = parseAspectRatio(props.widget.aspect_ratio);
    if (ratio) {
      // Use CSS aspect-ratio property for proper sizing
      // Set height to auto so aspect-ratio can control the height
      return { 'aspect-ratio': `${ratio}`, height: 'auto' };
    }
    return {};
  });

  return (
    <div class={styles.widgetView} style={containerStyle()}>
      <div id="player-widget" class={styles.widgetPlayer}></div>
      <div id="controls-widget" class={styles.widgetControls}></div>
    </div>
  );
};
