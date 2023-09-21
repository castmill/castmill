import { Component, For, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { TemplateConfig, resolveOption } from "./binding";
import { Subscription, of, share, switchMap, take } from "rxjs";
import { TemplateComponent, TemplateComponentType } from "./template";
import { JsonPlaylist } from "../../interfaces";
import { Playlist } from "../../playlist";
import { ResourceManager } from "@castmill/cache";
import { Renderer } from "../../renderer";
import { Timeline, TimelineItem } from "./timeline";
import { timer } from "../../player";
import { ComponentAnimation } from "./animation";
import { BaseComponentProps } from "./interfaces/base-component-props";
import { PlayerGlobals } from "../../interfaces/player-globals.interface";

export interface LayoutContainer {
  playlist: JsonPlaylist;
  style: JSX.CSSProperties;
}

export interface LayoutComponentOptions {
  containers: LayoutContainer[];
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
    layout.playlists = json.opts.containers.map((container: LayoutContainer) =>
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
    return {
      containers: resolveOption(opts.containers, config, context, globals),
    };
  }
}
interface LayoutProps extends BaseComponentProps {
  opts: LayoutComponentOptions;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

export const Layout: Component<LayoutProps> = (props) => {
  const timeline = new Timeline("layout");
  const timelineItem = {
    start: props.timeline.duration(),
    child: timeline,
  };
  props.timeline.add(timelineItem);

  const merged = mergeProps(
    {
      width: "100%",
      height: "100%",
    },
    props.style
  );

  onCleanup(() => {
    props.timeline.remove(timelineItem);
  });

  onMount(() => {
    props.onReady();
  });

  return (
    <For each={props.opts.containers}>
      {(container, i) => (
        <LayoutContainer
          container={container}
          style={container.style}
          timeline={timeline}
          resourceManager={props.resourceManager}
          globals={props.globals}
        />
      )}
    </For>
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
  let containerRef: HTMLDivElement | undefined;
  let renderer: Renderer | undefined;

  let timeline: Timeline;
  let timelineItem: TimelineItem;
  let showingSubscription: Subscription;
  let seekinSubscription: Subscription;

  const playlist = Playlist.fromJSON(
    props.container.playlist,
    props.resourceManager,
    props.globals
  );

  onCleanup(() => {
    showingSubscription?.unsubscribe();
    seekinSubscription?.unsubscribe();
    timelineItem && props.timeline.remove(timelineItem);
    playlist.layers.forEach((item) => item.unload());
    renderer?.clean();
  });

  onMount(() => {
    const playlistDuration = playlist.duration();
    timeline = new Timeline("layout-container", {
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
      containerRef.style.position = "absolute";
      renderer = new Renderer(containerRef);
      const seek = timeline.seek.bind(timeline);
      (timeline as any).seek = (time: number) => {
        // seekinSubscription?.unsubscribe();
        seekinSubscription = playlist
          .seek(time)
          .pipe(switchMap(() => playlist.show(renderer!)))
          .subscribe(() => {
            seek(time);
          });
      };

      showingSubscription = playlist.show(renderer!).subscribe((ev) => {});

      let playing$: Subscription;
      let timer$;
      let timerSubscription: Subscription;

      const play = timeline.play.bind(timeline);
      (timeline as any).play = () => {
        const timer$ = timer(
          Date.now(),
          playlist.time,
          100,
          playlist.duration()
        ).pipe(share());

        timerSubscription = timer$.subscribe({
          error: (err) => {
            console.log("Timer error", err);
          },
        });

        playing$ = playlist
          .play(renderer!, timer$, { loop: true })
          .subscribe((evt) => void 0);
        play();
      };

      const pause = timeline.pause.bind(timeline);
      (timeline as any).pause = () => {
        playing$?.unsubscribe();
        timerSubscription?.unsubscribe();
        pause();
      };

      // props.onReady();
    }
  });

  return <div ref={containerRef} style={props.style}></div>;
};

/*

// These are methods used by the old layout widget that we leave here for reference,
// as we have not yet implemented clipping.

show(el: HTMLElement) {
  this.el = el;
  this.items.forEach((item) => {
    el.appendChild(item.renderer.el);
  });
  return combineLatest(
    this.clipLayouts().map((item) => item.playlist.show(item.renderer))
  ).pipe(map((values) => values[0]));
}

play(timer$: Observable<number>): Observable<string | number> {
  return combineLatest(
    this.clipLayouts().map((item) =>
      item.playlist.play(item.renderer, timer$, { loop: true })
    )
  ).pipe(map((values) => values[0]));
}

seek(offset: number): Observable<[number, number]> {
  return combineLatest(
    this.items.map((item) => item.playlist.seek(offset))
  ).pipe(map((values) => values[0]));
}

  private findParentClip(el: HTMLElement): HTMLElement | null {
    if (el.parentElement) {
      const parent = el.parentElement;
      if (parent.dataset.clip) {
        return parent;
      } else {
        return this.findParentClip(parent);
      }
    } else {
      return null;
    }
  }

  private clipLayouts() {
    const el = this.el;
    if (!el) {
      return this.items;
    }

    const parentClipElement = this.findParentClip(el);
    if (parentClipElement) {
      const parentRect = JSON.parse(parentClipElement.dataset.clip!);
      const { x, y } = parentClipElement.getBoundingClientRect();

      return this.items.filter((item) => {
        const itemRect = item.renderer.el.getBoundingClientRect();
        return this.areRectanglesIntersecting(itemRect, parentRect, x, y);
      });
    } else {
      return this.items;
    }
  }

  private areRectanglesIntersecting(
    aRect: DOMRect,
    bRect: DOMRect,
    offsetX: number,
    offsetY: number
  ): boolean {
    let { x: x0, width: w0, y: y0, height: h0 } = aRect;
    const { x: x1, width: w1, y: y1, height: h1 } = bRect;

    x0 -= offsetX;
    y0 -= offsetY;

    return !(x0 >= x1 + w1 || x0 + w0 <= x1 || y0 >= y1 + h1 || y0 + h0 <= y1);
  }
*/
