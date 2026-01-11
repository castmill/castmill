import { Component, For, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { Subscription, share, switchMap, take } from 'rxjs';
import { TemplateComponent, TemplateComponentType } from './template';
import { JsonPlaylist, LayoutOptionValue } from '../../interfaces';
import { Playlist } from '../../playlist';
import { ResourceManager } from '@castmill/cache';
import { Renderer } from '../../renderer';
import { Timeline, TimelineItem } from './timeline';
import { timer } from '../../player';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';
import { rectToStyle, zoneToStyle, LayoutRect } from './layout-utils';

// Re-export from layout-utils for external use
export { rectToStyle, zoneToStyle } from './layout-utils';
export type { LayoutRect } from './layout-utils';

export interface LayoutContainer {
  playlist: JsonPlaylist;
  style: JSX.CSSProperties;
  rect?: LayoutRect; // Template can use rect instead of style
}

export interface LayoutComponentOptions {
  containers: LayoutContainer[];
}

/**
 * Converts LayoutOptionValue (zone-based format) to LayoutContainer array.
 * This bridges the zone-based format with the existing container-based rendering.
 *
 * Note: Zones can specify either:
 * - A `playlist` binding (e.g., {"key": "options.playlist_zone1"}) which gets resolved
 * - A `playlistId` for direct reference (requires config to contain playlist mapping)
 */
function zonesToContainers(
  layoutValue: LayoutOptionValue,
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
): LayoutContainer[] {
  return layoutValue.zones.map((zone) => {
    // If the zone has a playlist binding, resolve it
    // This matches the existing container format for playlist resolution
    let resolvedPlaylist: JsonPlaylist | null = null;

    if ((zone as any).playlist) {
      // Zone has a playlist binding - resolve it
      resolvedPlaylist = resolveOption(
        (zone as any).playlist,
        config,
        context,
        globals
      );
    }

    return {
      playlist: resolvedPlaylist as JsonPlaylist,
      // Cast to JSX.CSSProperties as zoneToStyle returns compatible style properties
      style: zoneToStyle(zone) as JSX.CSSProperties,
    };
  });
}

export class LayoutComponent implements TemplateComponent {
  private playlists: Playlist[] = [];

  readonly type = TemplateComponentType.Layout;

  constructor(
    public name: string,
    public opts: LayoutComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    return this.playlists.reduce(
      (acc: number, playlist: Playlist) => Math.max(acc, playlist.duration()),
      0
    );
  }

  static fromJSON(
    json: {
      opts: LayoutComponentOptions;
      style: JSX.CSSProperties;
      name: string;
      animations?: ComponentAnimation[];
      filter?: Record<string, any>;
    },
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): LayoutComponent {
    const layout = new LayoutComponent(
      json.name,
      json.opts,
      json.style,
      json.animations,
      json.filter
    );
    const containers = json.opts?.containers || [];
    layout.playlists = containers.map((container: LayoutContainer) =>
      Playlist.fromJSON(container.playlist, resourceManager, globals)
    );

    return layout;
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): LayoutComponentOptions {
    // Check for layout-ref format (from Layout Widget with layout reference)
    // The layoutRef has layoutId and zonePlaylistMap with playlist assignments
    if (opts.layoutRef) {
      const layoutRef = resolveOption(opts.layoutRef, config, context, globals);
      if (layoutRef?.zonePlaylistMap) {
        // Convert zonePlaylistMap to containers
        // We need the layout zones info - this should come from the stored layout data
        const containers: LayoutContainer[] = [];

        // Get zones from the layout (they should be stored with the layoutRef)
        const zones = layoutRef.zones?.zones || [];

        for (const zone of zones) {
          const zoneAssignment = layoutRef.zonePlaylistMap[zone.id];
          containers.push({
            playlist: zoneAssignment?.playlist || null,
            style: zoneToStyle(zone) as JSX.CSSProperties,
          });
        }

        return { containers };
      }
    }

    // Check if this is the zone-based format
    // This format has 'zones' array and 'aspectRatio' property
    if (opts.zones && Array.isArray(opts.zones)) {
      const layoutValue = resolveOption(
        opts,
        config,
        context,
        globals
      ) as LayoutOptionValue;
      const containers = zonesToContainers(
        layoutValue,
        config,
        context,
        globals
      );
      return { containers };
    }

    // Legacy format: template-based containers
    const resolvedContainers = resolveOption(
      opts.containers,
      config,
      context,
      globals
    );

    // Convert rect to style for each container if rect is provided
    // Also resolve the playlist binding for each container
    const containers = (resolvedContainers || []).map((container: any) => {
      // Resolve the playlist binding - it might be {key: "options.playlist_1"} or already resolved
      const resolvedPlaylist = resolveOption(
        container.playlist,
        config,
        context,
        globals
      );

      const result: LayoutContainer = {
        playlist: resolvedPlaylist,
        style: container.style || {},
      };

      // If rect is provided, convert to CSS style properties
      if (container.rect) {
        result.style = {
          ...result.style,
          ...rectToStyle(container.rect),
        };
      }

      return result;
    });

    return { containers };
  }
}
interface LayoutProps extends BaseComponentProps {
  opts: LayoutComponentOptions;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

export const Layout: Component<LayoutProps> = (props) => {
  const timeline = new Timeline('layout', { loop: true });

  // Override play to safeguard against NaN offset (can happen if parent timeline had duration 0)
  const originalPlay = timeline.play.bind(timeline);
  timeline.play = (offset: number = 0) => {
    const safeOffset = isNaN(offset) ? 0 : offset;
    originalPlay(safeOffset);
  };

  const timelineItem = {
    start: 0,
    child: timeline,
    repeat: true, // Layout should always be considered for playing
  };
  props.timeline.add(timelineItem);

  const merged = mergeProps(
    {
      width: '100%',
      height: '100%',
      position: 'relative' as const,
    },
    props.style
  );

  onCleanup(() => {
    props.timeline.remove(timelineItem);
  });

  onMount(() => {
    // If the parent timeline is already playing when we mount,
    // we need to manually start our timeline since we missed the initial play call
    if (props.timeline.isRunning()) {
      // Give a small delay to ensure container children have mounted and set up their play overrides
      setTimeout(() => {
        timeline.play(props.timeline.time - timelineItem.start);
      }, 0);
    }
    props.onReady();
  });

  return (
    <div style={merged}>
      <For each={props.opts.containers}>
        {(container) => (
          <LayoutContainer
            container={container}
            style={container.style}
            timeline={timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
          />
        )}
      </For>
    </div>
  );
};

/**
 * Placeholder component for containers without a playlist selected.
 * Shows an empty container with the positioning styles applied.
 */
const LayoutContainerPlaceholder: Component<{
  style: JSX.CSSProperties;
}> = (props) => {
  return (
    <div
      style={{
        ...props.style,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'background-color': 'rgba(128, 128, 128, 0.2)',
        border: '1px dashed rgba(128, 128, 128, 0.5)',
      }}
    >
      <span style={{ color: 'rgba(128, 128, 128, 0.7)', 'font-size': '0.8em' }}>
        No playlist selected
      </span>
    </div>
  );
};

const LayoutContainer: Component<{
  container: LayoutContainer;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
  style: JSX.CSSProperties;
  timeline: Timeline;
  // onReady: () => void;
}> = (props) => {
  // If no playlist is selected or playlist has no items, render a placeholder
  if (
    !props.container.playlist ||
    !props.container.playlist.items ||
    props.container.playlist.items.length === 0
  ) {
    return <LayoutContainerPlaceholder style={props.style} />;
  }

  let containerRef: HTMLDivElement | undefined;
  let renderer: Renderer | undefined;

  let timeline: Timeline;
  let timelineItem: TimelineItem;
  let showingSubscription: Subscription;
  let seekingSubscription: Subscription;

  const playlist = Playlist.fromJSON(
    props.container.playlist,
    props.resourceManager,
    props.globals
  );

  onCleanup(() => {
    showingSubscription?.unsubscribe();
    seekingSubscription?.unsubscribe();
    timelineItem && props.timeline.remove(timelineItem);
    playlist.layers.forEach((item) => item.unload());
    renderer?.clean();
  });

  onMount(() => {
    // Don't pass a fixed duration - let the timeline calculate it dynamically
    // from its children (e.g., scroller items). This allows the duration to
    // be determined after all widgets are mounted and their durations are known.
    timeline = new Timeline('layout-container', {
      loop: true,
    });

    // Override duration to return the playlist's actual duration
    // This allows the parent timeline to calculate the correct max duration
    const originalDuration = timeline.duration.bind(timeline);
    timeline.duration = () => {
      const playlistDur = playlist.duration();
      return playlistDur > 0 ? playlistDur : originalDuration();
    };

    // Mark as repeat so parent timeline knows to keep it playing during loops
    // The duration is 0/dynamic but it should continue playing
    timelineItem = {
      start: 0,
      child: timeline,
      repeat: true,
    };

    props.timeline.add(timelineItem);

    if (containerRef) {
      // Position is set via style prop from rectToStyle conversion
      renderer = new Renderer(containerRef);

      let playing$: Subscription;
      let timerSubscription: Subscription;
      let isPlaying = false;
      let isReady = false;
      let pendingPlayOffset: number | null = null;
      let isSeeking = false;
      let seekTarget: number = 0;

      // Helper to unsubscribe from playback subscriptions
      const unsubscribePlaying = () => {
        playing$?.unsubscribe();
        timerSubscription?.unsubscribe();
      };

      // Helper to start/restart playback from a given time (synchronous, assumes seek is done)
      const startPlaybackImmediate = (startTime: number = 0) => {
        // Clean up previous playback
        unsubscribePlaying();

        const playlistDur = playlist.duration();

        const timer$ = timer(Date.now(), startTime, 100, playlistDur).pipe(
          share()
        );

        timerSubscription = timer$.subscribe();

        playing$ = playlist.play(renderer!, timer$, { loop: true }).subscribe({
          error: (err) =>
            console.error('[LayoutContainer] playlist.play error:', err),
        });
      };

      const originalSeek = timeline.seek.bind(timeline);
      (timeline as any).seek = (time: number) => {
        // Track that we're seeking and to what position
        isSeeking = true;
        seekTarget = time;

        // Stop current playback before seeking - this is critical!
        // Without this, nested widgets' timelines may still be in "playing" state
        // and will throw "Cannot seek while playing"
        unsubscribePlaying();

        // When seeking (e.g., during loop restart), prepare playlist for the new position
        seekingSubscription?.unsubscribe();

        // Reset playlist time immediately
        playlist.time = time;

        seekingSubscription = playlist
          .seek(time)
          .pipe(switchMap(() => playlist.show(renderer!)))
          .subscribe(() => {
            isSeeking = false;
            originalSeek(time);
            // If we should be playing, start playback from the seek position
            if (isPlaying) {
              startPlaybackImmediate(time);
            }
          });
      };

      // Show the playlist content first - this must complete before play works correctly
      showingSubscription = playlist
        .show(renderer!)
        .pipe(take(1))
        .subscribe({
          next: () => {
            isReady = true;
            // If play was called before show completed, start playback now
            if (pendingPlayOffset !== null) {
              const offset = pendingPlayOffset;
              pendingPlayOffset = null;
              playlist.time = offset;
              playlist.seek(offset).subscribe(() => {
                startPlaybackImmediate(offset);
              });
            }
          },
          error: (err) => {
            console.error('Error showing playlist in layout container', err);
          },
        });

      const originalPlay = timeline.play.bind(timeline);
      (timeline as any).play = (offset: number = 0) => {
        isPlaying = true;

        // If we're in the middle of a seek operation, don't start playback here.
        // The seek callback will start playback when it completes.
        if (isSeeking) {
          originalPlay(offset);
          return;
        }

        if (isReady) {
          // Seek first, then start playback
          playlist.time = offset;
          playlist.seek(offset).subscribe(() => {
            startPlaybackImmediate(offset);
          });
        } else {
          // Defer playback until show completes
          pendingPlayOffset = offset;
        }
        originalPlay(offset);
      };

      const originalPause = timeline.pause.bind(timeline);
      (timeline as any).pause = () => {
        isPlaying = false;
        pendingPlayOffset = null;
        playing$?.unsubscribe();
        timerSubscription?.unsubscribe();
        originalPause();
      };

      // If the parent timeline (layout's timeline) is already running,
      // we need to start our playlist playback manually since we missed the play call
      if (props.timeline.isRunning()) {
        const currentTime = props.timeline.time;
        // Trigger our overridden play method
        // Safeguard against NaN (can happen if parent timeline started with duration 0)
        const safeTime = isNaN(currentTime) ? 0 : currentTime;
        (timeline as any).play(safeTime);
      }

      // props.onReady();
    }
  });

  return <div ref={containerRef} style={props.style}></div>;
};
