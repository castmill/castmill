import {
  Component,
  onMount,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  Show,
} from 'solid-js';
import {
  firstValueFrom,
  Subject,
  Subscription,
  take,
  takeUntil,
  timeout,
} from 'rxjs';

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
  loadingLabel?: string;
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
  const [loading, setLoading] = createSignal(true);

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

    setLoading(true);
    const shownSubscription = playerUI.shown$
      .pipe(take(1))
      .subscribe(() => setLoading(false));
    onCleanup(() => shownSubscription.unsubscribe());

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
        const MAX_WAIT_MS = 10000;

        cancelPriming?.();
        if (!active || !playerContainer) return undefined;
        const getOffsets = (): LayerOffset[] => {
          controls.setTimeDuration(
            controls.seek,
            playlist.duration(),
            previewPlayer!.loop
          );
          let end = 0;
          return playlist.layers.map((layer) => {
            const duration = layer.duration();
            const start = end;
            end += duration;
            return { start, end, duration };
          });
        };
        const dynamicLayerIndices = playlistJSON.items.flatMap((item, index) =>
          item.duration > 0 ? [] : [index]
        );
        if (dynamicLayerIndices.length === 0) return getOffsets();

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
        const cancelled$ = new Subject<void>();
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
          cancelled$.next();
          cancelled$.complete();
          renderer.clear();
          pl.unload();
          stage.remove();
        };
        cancelPriming = cancel;

        try {
          for (const i of dynamicLayerIndices) {
            // Let the editor respond between expensive background renders.
            await wait(0);
            if (cancelled) break;
            const result = await firstValueFrom(
              renderer
                .show(pl.layers[i], 0)
                .pipe(timeout({ first: MAX_WAIT_MS }), takeUntil(cancelled$)),
              { defaultValue: undefined }
            );
            if (cancelled) return undefined;
            if (result === undefined || result === 'error') {
              throw new Error(`Preview layer ${i} did not become ready`);
            }
            if (!cancelled) {
              playlist.layers[i].setDurationHint(pl.layers[i].duration());
            }
          }
          if (cancelled || !active) return undefined;
          return getOffsets();
        } catch (error) {
          console.error(
            '[PlaylistPreview] Duration measurement failed:',
            error
          );
          return undefined;
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
      <Show when={loading()}>
        <div
          class={styles.previewLoading}
          role="status"
          aria-label={props.loadingLabel ?? 'Loading...'}
          data-testid="playlist-preview-loading"
        >
          <div class={styles.previewSpinner}></div>
        </div>
      </Show>
      <div id="controls" class={styles.playlistControls}></div>
    </div>
  );
};
