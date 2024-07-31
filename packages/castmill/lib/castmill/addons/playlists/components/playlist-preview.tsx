import { Component, onMount, createEffect, onCleanup } from 'solid-js';

import {
  Playlist,
  PlayerUI,
  PlayerUIControls,
  JsonPlaylist,
} from '@castmill/player';
import { ResourceManager, Cache, StorageDummy } from '@castmill/cache';

import styles from './widget-view.module.scss';

interface PlaylistPreviewProps {
  playlist: JsonPlaylist;
}

export const PlaylistPreview: Component<PlaylistPreviewProps> = (props) => {
  const cache = new Cache(
    new StorageDummy('widget-editor'),
    'widget-editor-cache',
    100
  );
  const resourceManager = new ResourceManager(cache);

  let controls: PlayerUIControls;
  let playerUI: PlayerUI;

  onMount(async () => {
    await cache.init();
  });

  createEffect(() => {
    const playlist = Playlist.fromJSON(props.playlist, resourceManager);

    if (controls) {
      controls.destroy();
    }

    controls = new PlayerUIControls('controls', {
      position: {
        bottom: '4em',
      },
    });

    if (playerUI) {
      playerUI.destroy();
    }

    playerUI = new PlayerUI('player', playlist, {
      controls,
      controlsMaster: true,
    });

    controls.setTimeDuration(0, playlist.duration(), true);
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
      <div id="player" class={styles.widgetPlayer}></div>
      <div id="controls" class={styles.widgetControls}></div>
    </div>
  );
};
