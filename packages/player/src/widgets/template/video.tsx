import {
  Component,
  JSX,
  mergeProps,
  onCleanup,
  onMount,
  createSignal,
  Show,
} from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import {
  Observable,
  Subscription,
  fromEvent,
  map,
  of,
  take,
  timeout,
} from 'rxjs';
import { TemplateComponent, TemplateComponentType } from './template';
import { Timeline, TimelineItem } from './timeline';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { ResourceManager } from '@castmill/cache';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

enum ReadyState {
  HAVE_NOTHING = 0, // No information is available about the media resource.
  HAVE_METADATA = 1, //	Enough of the media resource has been retrieved that the metadata attributes are initialized. Seeking will no longer raise an exception.
  HAVE_CURRENT_DATA = 2, // Data is available for the current playback position, but not enough to actually play more than one frame.
  HAVE_FUTURE_DATA = 3, // Data for the current playback position as well as for at least a little bit of time into the future is available (in other words, at least two frames of video, for example).
  HAVE_ENOUGH_DATA = 4, // Enough data is available—and the download rate is high enough—that the media can be played through to the end without interruption.
}

export interface VideoComponentOptions {
  url: string;
  size: 'cover' | 'contain';
}

export class VideoComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Video;

  constructor(
    public name: string,
    public opts: VideoComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration_old(medias: { [index: string]: string }): Observable<number> {
    const videoUrl = medias[this.opts.url];

    if (!videoUrl) {
      throw new Error(`Video ${this.opts.url} not found in medias`);
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = videoUrl;

    return fromEvent(video, 'durationchange').pipe(
      take(1),
      map((evt) => {
        const duration = (video?.duration ?? 0) * 1000;
        video.src = '';
        return duration;
      })
    );
  }

  resolveDuration(medias: { [index: string]: string }): number {
    // Return a default fallback duration. The actual video duration is determined
    // dynamically when the video loads and is added to the timeline.
    // This fallback is only used if the video hasn't loaded yet.
    return 10000;
  }

  static fromJSON(json: any): VideoComponent {
    return new VideoComponent(
      json.name,
      json.opts,
      json.style,
      json.animations,
      json.filter
    );
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): VideoComponentOptions {
    return {
      url: resolveOption(opts.url, config, context, globals),
      size: resolveOption(opts.size, config, context, globals),
    };
  }
}

interface VideoProps extends BaseComponentProps {
  opts: VideoComponentOptions;
  resourceManager: ResourceManager;
}

export const Video: Component<VideoProps> = (props) => {
  let videoRef: HTMLVideoElement | undefined;

  let timeline: Timeline;
  let timelineItem: TimelineItem;

  const merged = mergeProps(
    {
      width: '100%',
      height: '100%',
    },
    props.style
  );

  let loadingSubscription: Subscription;
  let seekingVideoSubscription: Subscription;

  onCleanup(() => {
    seekingVideoSubscription?.unsubscribe();
    loadingSubscription?.unsubscribe();
    if (timelineItem) {
      props.timeline.remove(timelineItem);
    }
    // timeline?.kill();
  });

  onMount(async () => {
    if (videoRef) {
      // Check if URL is defined before trying to get media
      if (!props.opts.url) {
        // No video selected yet - this is normal when widget is first added
        props.onReady();
        return;
      }

      const videoUrl = await props.resourceManager.getMedia(props.opts.url);
      if (!videoUrl) {
        console.warn(`[Video] Video ${props.opts.url} not found in cache`);
        props.onReady();
        return;
      }

      videoRef.src = videoUrl;

      seekingVideoSubscription?.unsubscribe();

      const seekVideo = (time: number): Observable<[number, number]> => {
        if (videoRef && videoRef.readyState >= ReadyState.HAVE_METADATA) {
          // Convert from milliseconds to seconds for HTMLVideoElement.currentTime
          const targetTime = time / 1000;
          videoRef.currentTime = targetTime;

          const slow$ = of([time, 0]);

          return fromEvent(videoRef, 'seeked').pipe(
            take(1),
            // Timeout for slow or video tags not implementing seeked event.
            timeout({
              each: 500,
              with: () => slow$,
            }),
            map((evt) => {
              return [time, 0];
            })
          );
        }
        return of([time, 0]);
      };

      loadingSubscription?.unsubscribe();

      // We need to handle two events:
      // 1. loadedmetadata - provides duration info (fast)
      // 2. canplaythrough - video is ready to play without buffering (slow)
      //
      // We add the timeline item on loadedmetadata so duration queries work,
      // but only call onReady after canplaythrough to ensure smooth playback.

      let timelineAdded = false;

      const addTimelineItem = () => {
        if (timelineAdded || !videoRef) return;
        timelineAdded = true;

        timeline = new Timeline('video');

        const child = {
          seek: (time: number) => {
            seekingVideoSubscription?.unsubscribe();
            seekingVideoSubscription = seekVideo(time).subscribe(
              (evt) => void 0
            );
          },
          play: (offset: number = 0) => {
            // Always seek to the offset before playing (offset is in milliseconds)
            // This is important for looping - when offset is 0, we need to reset to start
            if (videoRef!.readyState >= ReadyState.HAVE_METADATA) {
              const targetTime = offset / 1000;
              videoRef!.currentTime = targetTime;
            }
            videoRef!.play();
          },
          pause: () => {
            videoRef!.pause();
          },
          duration: () => {
            return videoRef!.duration * 1000;
          },
        };

        timelineItem = {
          start: 0, // Videos should always start at the beginning of their timeline
          duration: videoRef!.duration * 1000,
          child,
        };
        props.timeline.add(timelineItem);
      };

      let loading$: Observable<string>;
      if (videoRef.readyState < ReadyState.HAVE_ENOUGH_DATA) {
        loading$ = new Observable<string>((subscriber) => {
          const metadataHandler = (ev: Event) => {
            // Add timeline item as soon as metadata is available
            // This allows duration queries to return the real value
            addTimelineItem();
          };

          const handler = (ev: Event) => {
            // Ensure timeline is added (in case canplaythrough fires before/without metadata)
            addTimelineItem();
            subscriber.next('video:loaded');
            subscriber.complete();
          };

          const errorHandler = (ev: Event) => {
            subscriber.error('error');
          };

          videoRef!.addEventListener('loadedmetadata', metadataHandler);
          videoRef!.addEventListener('canplaythrough', handler);
          videoRef!.addEventListener('error', errorHandler);

          return () => {
            videoRef!.removeEventListener('loadedmetadata', metadataHandler);
            videoRef!.removeEventListener('canplaythrough', handler);
            videoRef!.removeEventListener('error', errorHandler);
          };
        });
        videoRef.load();
      } else {
        // Video is already loaded, add timeline immediately
        addTimelineItem();
        loading$ = of('video:loaded');
      }

      loadingSubscription = loading$.subscribe({
        next: (ev) => {
          props.onReady();
        },
        error: (err) => {
          console.error('[Video] Error loading video:', err);
          props.onReady();
        },
      });
    }
  });

  return (
    <>
      <Show when={!props.opts.url}>
        <div
          data-component="video-placeholder"
          data-name={props.name}
          style={{
            ...merged,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            background: '#1a1a2e',
            color: '#666',
            'font-size': '1.5em',
          }}
        >
          No video selected
        </div>
      </Show>
      <video
        ref={videoRef}
        data-component="video"
        data-name={props.name}
        style={{
          ...merged,
          display: props.opts.url ? 'block' : 'none',
        }}
        playsinline
      ></video>
    </>
  );
};
