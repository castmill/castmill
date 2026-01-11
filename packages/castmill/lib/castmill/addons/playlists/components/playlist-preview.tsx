import { Component, onMount, createEffect, onCleanup } from 'solid-js';
import { Subscription } from 'rxjs';

import {
  Playlist,
  PlayerUI,
  PlayerUIControls,
  JsonPlaylist,
} from '@castmill/player';
import { safeStringify } from './utils';
import { ResourceManager, Cache, StorageDummy } from '@castmill/cache';

import styles from './widget-view.module.scss';

export interface LayerOffset {
  start: number;
  end: number;
  duration: number;
}

export interface PlaylistPreviewRef {
  seek: (offset: number) => void;
  getLayerOffsets: () => LayerOffset[];
  primeAllLayers: () => Promise<LayerOffset[]>;
}

interface PlaylistPreviewProps {
  playlist: JsonPlaylist;
  onReady?: (ref: PlaylistPreviewRef) => void;
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
  let playerContainer: HTMLDivElement | undefined;
  let currentSeekSubscription: Subscription | null = null;
  let currentPlaylist: Playlist | null = null;

  onMount(async () => {
    await cache.init();
  });

  createEffect(() => {
    // Force SolidJS to track deep changes in playlist by serializing
    // This ensures the effect re-runs when any nested property changes
    // (e.g., when an item's config.options are updated)
    const _playlistFingerprint = safeStringify(props.playlist);

    const playlist = Playlist.fromJSON(props.playlist, resourceManager);
    currentPlaylist = playlist;

    if (controls) {
      controls.destroy();
    }

    controls = new PlayerUIControls('controls', {
      position: {
        bottom: '0',
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

    // Expose seek function and layer offsets to parent component
    props.onReady?.({
      seek: (offset: number) => {
        // Cancel any previous seek operation
        if (currentSeekSubscription) {
          currentSeekSubscription.unsubscribe();
          currentSeekSubscription = null;
        }

        currentSeekSubscription = playerUI.seek(offset).subscribe({
          error: (err) => console.error('[PlaylistPreview] seek error:', err),
          complete: () => {
            currentSeekSubscription = null;
          },
        });
      },
      getLayerOffsets: (): LayerOffset[] => {
        // Calculate offsets from actual layer durations
        let end = 0;
        return playlist.layers.map((layer) => {
          const duration = layer.duration();
          const start = end;
          end += duration;
          return { start, end, duration };
        });
      },
      primeAllLayers: async (): Promise<LayerOffset[]> => {
        // Trigger each layer to load and calculate its duration.
        // We don't wait for seek() to complete (which blocks on canplaythrough),
        // we just trigger it and wait for the duration to become available.
        // This is much faster because loadedmetadata fires before canplaythrough.
        const FALLBACK_DURATION = 10000; // Player's default fallback in ms
        const MAX_WAIT_MS = 10000; // Maximum time to wait for duration per layer
        const POLL_INTERVAL_MS = 100; // How often to check for duration change
        const MIN_WAIT_MS = 500; // Minimum wait time for widgets with dynamic content (scrollers, etc.)

        const pl = currentPlaylist;
        if (!playerUI) {
          return [];
        }

        // Helper: wait until a layer's duration changes from fallback, or timeout
        // For dynamic duration widgets (scrollers, videos), we wait a minimum time
        // to ensure their internal initialization completes
        const waitForDuration = async (layerIndex: number): Promise<void> => {
          const layer = pl.layers[layerIndex];
          const startTime = Date.now();
          const initialDuration = layer.duration();

          // If it's already non-fallback, we're done
          if (initialDuration !== FALLBACK_DURATION) {
            return;
          }

          // Always wait at least MIN_WAIT_MS to allow dynamic content to initialize
          // (scrollers need fonts + layout + animation frames)
          await new Promise((r) => setTimeout(r, MIN_WAIT_MS));

          // Check if duration changed during minimum wait
          let currentDuration = layer.duration();
          if (currentDuration !== FALLBACK_DURATION) {
            return;
          }

          // Continue polling until duration changes or timeout
          while (Date.now() - startTime < MAX_WAIT_MS) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            currentDuration = layer.duration();
            if (currentDuration !== FALLBACK_DURATION) {
              return;
            }
          }
          // Timeout - layer keeps fallback duration (might be intentional)
        };

        // Process each layer
        for (let i = 0; i < pl.layers.length; i++) {
          // Calculate seek target based on current known durations
          let seekTarget = 0;
          for (let j = 0; j < i; j++) {
            seekTarget += pl.layers[j].duration();
          }

          // Fire seek to trigger the layer to load - don't wait for completion
          // The seek triggers show() which starts loading the widget
          playerUI.seek(seekTarget).subscribe({
            error: (err) => console.error('[primeAllLayers] seek error:', err),
          });

          // Wait for this layer's duration to be calculated
          // This completes quickly once loadedmetadata fires (for videos)
          await waitForDuration(i);
        }

        // Seek back to start (fire and forget)
        playerUI.seek(0).subscribe({
          error: (err) =>
            console.error('[primeAllLayers] seek to start error:', err),
        });

        // Update the controls with the correct total duration now that all layers are primed
        const totalDuration = pl.layers.reduce(
          (acc, layer) => acc + layer.duration(),
          0
        );
        controls.setTimeDuration(0, totalDuration, true);

        // Return the updated offsets
        let end = 0;
        const result = pl.layers.map((layer, i) => {
          const duration = layer.duration();
          const start = end;
          end += duration;
          return { start, end, duration };
        });

        return result;
      },
    });
  });

  onCleanup(() => {
    // Cancel any pending seek operation
    if (currentSeekSubscription) {
      currentSeekSubscription.unsubscribe();
      currentSeekSubscription = null;
    }

    if (playerUI) {
      playerUI.destroy();
    }

    if (controls) {
      controls.destroy();
    }
  });

  return (
    <div class={styles.widgetView} ref={playerContainer}>
      <div id="player" class={styles.widgetPlayer}></div>
      <div id="controls" class={styles.widgetControls}></div>
    </div>
  );
};
