import { Component, For, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { Subscription, share, switchMap, take } from 'rxjs';
import { TemplateComponent, TemplateComponentType } from './template';
import { JsonPlaylist } from '../../interfaces';
import { Playlist } from '../../playlist';
import { ResourceManager } from '@castmill/cache';
import { Renderer } from '../../renderer';
import { Timeline, TimelineItem } from './timeline';
import { timer } from '../../player';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

/**
 * Rect defines the positioning of a container within the layout.
 * Values are typically percentages (e.g., "33.33%", "100%").
 */
export interface LayoutRect {
  width: string;
  height: string;
  top: string;
  left: string;
}

export interface LayoutContainer {
  playlist: JsonPlaylist;
  style: JSX.CSSProperties;
  rect?: LayoutRect; // Template can use rect instead of style
}

export interface LayoutComponentOptions {
  containers: LayoutContainer[];
}

/**
 * Converts a rect object to CSS style properties for absolute positioning.
 */
function rectToStyle(rect: LayoutRect): JSX.CSSProperties {
  return {
    position: 'absolute',
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
  };
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
  const timeline = new Timeline('layout');

  // Override play to safeguard against NaN offset (can happen if parent timeline had duration 0)
  const originalPlay = timeline.play.bind(timeline);
  timeline.play = (offset: number = 0) => {
    const safeOffset = isNaN(offset) ? 0 : offset;
    originalPlay(safeOffset);
  };

  const timelineItem = {
    start: props.timeline.duration(),
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
    const playlistDuration = playlist.duration();

    timeline = new Timeline('layout-container', {
      loop: true,
      duration: playlistDuration,
    });
    timelineItem = {
      start: 0,
      duration: playlistDuration,
      child: timeline,
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

      // Helper to start/restart playback from a given time
      const startPlayback = (startTime: number = 0) => {
        // Clean up previous playback
        playing$?.unsubscribe();
        timerSubscription?.unsubscribe();

        // Reset playlist time
        playlist.time = startTime;

        // Seek to the start position first to ensure layers are properly initialized
        playlist.seek(startTime).subscribe(() => {
          const timer$ = timer(
            Date.now(),
            startTime,
            100,
            playlist.duration()
          ).pipe(share());

          timerSubscription = timer$.subscribe();

          playing$ = playlist
            .play(renderer!, timer$, { loop: true })
            .subscribe((evt) => void 0);
        });
      };

      const originalSeek = timeline.seek.bind(timeline);
      (timeline as any).seek = (time: number) => {
        // When seeking (e.g., during loop restart), restart playback from the new position
        seekingSubscription?.unsubscribe();
        seekingSubscription = playlist
          .seek(time)
          .pipe(switchMap(() => playlist.show(renderer!)))
          .subscribe(() => {
            originalSeek(time);
            // If we were playing, restart playback from the seek position
            if (isPlaying) {
              startPlayback(time);
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
              startPlayback(pendingPlayOffset);
              pendingPlayOffset = null;
            }
          },
          error: (err) => {
            console.error('Error showing playlist in layout container', err);
          },
        });

      const originalPlay = timeline.play.bind(timeline);
      (timeline as any).play = (offset: number = 0) => {
        isPlaying = true;
        if (isReady) {
          startPlayback(offset);
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
