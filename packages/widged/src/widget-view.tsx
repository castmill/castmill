import { onMount } from 'solid-js';
import { createEffect } from 'solid-js';

import { useFileContent } from './file-context-provider';

import { Playlist, PlayerUI, PlayerUIControls } from '@castmill/player';
import {
  ResourceManager,
  Cache,
  StorageDummy,
} from '@castmill/cache';

import styles from './widget-view.module.scss';

export const WidgetView = () => {
  const { fileContent } = useFileContent();

  const cache = new Cache(
    new StorageDummy('widget-editor'),
    'widget-editor-cache',
    100
  );
  const resourceManager = new ResourceManager(cache);

  let playlist: Playlist;

  createEffect(() => {
    const widget = JSON.parse(fileContent());

    const layer = {
      id: 123,
      offset: 0,
      name: 'widget-layer',
      duration: 10000,
      slack: 1000,
      widget,
      style: {
        width: '100%',
        height: '100%',
      },
      config: {
        id: 'my-config-id',
        widget_id: widget.id,
        options: {},
        data: {},
      },
    };

    const jsonPlaylist = {
      id: 123,
      name: 'widget-playlist',
      items: [layer],
      status: 'live' as 'live' | 'draft' | 'archived',
    };

    playlist = Playlist.fromJSON(jsonPlaylist, resourceManager);
  });

  onMount(async () => {
    await cache.init();

    const controls = new PlayerUIControls('controls', {
      position: {
        bottom: '4em',
      },
    });

    new PlayerUI('player', playlist, {
      controls,
      controlsMaster: true,
    });
  });

  return (
    <div class={styles['widget-view']}>
      <div id="player" class={styles['widget-player']}></div>
      <div id="controls" class={styles['widget-controls']}></div>
    </div>
  );
};
