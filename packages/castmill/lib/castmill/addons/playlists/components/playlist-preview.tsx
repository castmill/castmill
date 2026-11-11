import { Component, onMount, createEffect, onCleanup, untrack } from 'solid-js';
import { Subscription } from 'rxjs';

import {
  Playlist,
  PlayerUI,
  PlayerUIControls,
  JsonPlaylist,
  Renderer,
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
  primeAllLayers: () => Promise<LayerOffset[] | undefined>;
}

interface PlaylistPreviewProps {
  playlist: JsonPlaylist;
  dynamicDurations?: Record<number, number>;
  onReady?: (ref: PlaylistPreviewRef) => void;
}

export const resolvePlaylistDuration = (
  playlist: Playlist,
  items: JsonPlaylist['items'],
  dynamicDurations?: Record<number, number>
) => {
  const durations: Record<number, number> = dynamicDurations ?? {};

  return playlist.layers.reduce((total, layer, index) => {
    const item = items[index];
    const dynamicDuration =
      item &&
      !(typeof item.duration === 'number' && item.duration > 0) &&
      typeof item.id === 'number'
        ? durations[item.id]
        : undefined;

    return (
      total +
      (typeof dynamicDuration === 'number' && dynamicDuration > 0
        ? dynamicDuration
        : layer.duration())
    );
  }, 0);
};

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

  onMount(async () => {
    await cache.init();
  });

  createEffect(() => {
    // Force SolidJS to track deep changes in playlist by serializing
    // This ensures the effect re-runs when any nested property changes
    // (e.g., when an item's config.options are updated)
    const _playlistFingerprint = safeStringify(props.playlist);

    let previewPlayer: PlayerUI | undefined;
    const playlistJSON = props.playlist;
    const playlist = Playlist.fromJSON(playlistJSON, resourceManager, {
      target: 'preview',
      freezePreviewDuringLoad: () => !previewPlayer?.isPlaying,
    });
    let active = true;
    let cancelPriming: (() => void) | undefined;
    onCleanup(() => {
      active = false;
      cancelPriming?.();
    });

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
    previewPlayer = playerUI;

    controls.setTimeDuration(
      0,
      resolvePlaylistDuration(
        playlist,
        props.playlist.items,
        untrack(() => props.dynamicDurations)
      ),
      true
    );

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
      primeAllLayers: async (): Promise<LayerOffset[] | undefined> => {
        // Measure a separate playlist so priming never seeks the visible player.
        const FALLBACK_DURATION = 10000; // Player's default fallback in ms
        const MAX_WAIT_MS = 10000; // Maximum time to wait for duration per layer
        const POLL_INTERVAL_MS = 100; // How often to check for duration change
        const MIN_WAIT_MS = 500; // Minimum wait time for widgets with dynamic content (scrollers, etc.)

        cancelPriming?.();
        if (!active || !playerContainer) return undefined;
        const pl = Playlist.fromJSON(playlistJSON, resourceManager, {
          target: 'preview',
          freezePreviewDuringLoad: true,
        });
        const stage = document.createElement('div');
        const bounds = playerContainer.getBoundingClientRect();
        Object.assign(stage.style, {
          position: 'fixed',
          left: '-10000px',
          top: '0',
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
          opacity: '0',
          pointerEvents: 'none',
        });
        document.body.appendChild(stage);
        const renderer = new Renderer(stage);
        let cancelled = false;
        let showSubscription: Subscription | undefined;
        let pendingTimer: ReturnType<typeof setTimeout> | undefined;
        let wake: (() => void) | undefined;
        const wait = (ms: number) =>
          new Promise<void>((resolve) => {
            wake = resolve;
            pendingTimer = setTimeout(() => {
              wake = undefined;
              resolve();
            }, ms);
          });
        const cancel = () => {
          if (cancelled) return;
          cancelled = true;
          clearTimeout(pendingTimer);
          wake?.();
          showSubscription?.unsubscribe();
          renderer.clear();
          pl.unload();
          stage.remove();
        };
        cancelPriming = cancel;

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
          await wait(MIN_WAIT_MS);

          // Check if duration changed during minimum wait
          let currentDuration = layer.duration();
          if (currentDuration !== FALLBACK_DURATION) {
            return;
          }

          // Continue polling until duration changes or timeout
          while (!cancelled && Date.now() - startTime < MAX_WAIT_MS) {
            await wait(POLL_INTERVAL_MS);
            currentDuration = layer.duration();
            if (currentDuration !== FALLBACK_DURATION) {
              return;
            }
          }
          // Timeout - layer keeps fallback duration (might be intentional)
        };

        try {
          for (let i = 0; i < pl.layers.length && !cancelled; i++) {
            showSubscription?.unsubscribe();
            showSubscription = renderer.show(pl.layers[i], 0).subscribe({
              error: (err) =>
                console.error('[primeAllLayers] show error:', err),
            });
            if (!(playlistJSON.items[i]?.duration > 0)) {
              await waitForDuration(i);
            }
            if (!cancelled) {
              playlist.layers[i].setDurationHint(pl.layers[i].duration());
            }
          }
          if (cancelled || !active) return undefined;
          const totalDuration = playlist.duration();
          controls.setTimeDuration(
            controls.seek,
            totalDuration,
            previewPlayer!.loop
          );
          let end = 0;
          return playlist.layers.map((layer) => {
            const duration = layer.duration();
            const start = end;
            end += duration;
            return { start, end, duration };
          });
        } finally {
          cancel();
          if (cancelPriming === cancel) cancelPriming = undefined;
        }
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
    <div class={styles.widgetView} ref={(el) => (playerContainer = el)}>
      <div id="player" class={styles.widgetPlayer}></div>
      <div id="controls" class={styles.playlistControls}></div>
    </div>
  );
};
