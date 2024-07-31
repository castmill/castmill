import { Component, onMount, createEffect, onCleanup } from 'solid-js';

import {
  Playlist,
  PlayerUI,
  PlayerUIControls,
  JsonPlaylistItem,
  JsonPlaylist,
  JsonWidgetConfig,
  JsonWidget,
  OptionsDict,
} from '@castmill/player';
import { ResourceManager, Cache, StorageDummy } from '@castmill/cache';

import styles from './widget-view.module.scss';

interface WidgetViewProps {
  widget: JsonWidget;
  config: JsonWidgetConfig;
  options: OptionsDict;
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

  createEffect(() => {
    const dummyJsonPlaylistItem: JsonPlaylistItem = {
      id: 123, // Dummy ID
      duration: 10000, // Dummy duration
      offset: 0, // Dummy offset
      widget: props.widget,
      slack: 1000, // Dummy slack
      name: 'widget-layer', // Dummy name
      config: { ...props.config, options: props.options },
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

  onMount(async () => {
    await cache.init();
  });

  onCleanup(() => {
    if (playerUI) {
      playerUI.destroy();
    }

    if (controls) {
      controls.destroy();
    }
  });

  return (
    <div class={styles.widgetView}>
      <div id="player-widget" class={styles.widgetPlayer}></div>
      <div id="controls-widget" class={styles.widgetControls}></div>
    </div>
  );
};
