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
import {
  PlayerGlobals,
  VideoPlaybackController,
} from '../../interfaces/player-globals.interface';

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
  globals: PlayerGlobals;
}

export function playVideo(
  video: Pick<HTMLVideoElement, 'play'>,
  reportError?: PlayerGlobals['reportError']
): void {
  const handleError = (error: unknown) => {
    console.error('[Video] Failed to start playback', error);
    reportError?.({
      category: 'playback',
      code: 'video-play-rejected',
      error,
    });
  };

  try {
    const playPromise = video.play();
    if (playPromise) {
      void playPromise.catch(handleError);
    }
  } catch (error) {
    handleError(error);
  }
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
  let playbackController: VideoPlaybackController | undefined;
  let disposed = false;

  onCleanup(() => {
    disposed = true;
    playbackController?.dispose();
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
      if (disposed) return;
      if (!videoUrl) {
        console.warn(`[Video] Video ${props.opts.url} not found in cache`);
        props.onReady();
        return;
      }

      videoRef.src = videoUrl;
      playbackController = props.globals.createVideoPlaybackController?.(
        videoRef,
        {
          reportError: props.globals.reportError,
          refreshMedia: () =>
            props.resourceManager.refreshMedia(props.opts.url),
        }
      );

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

      // The WebOS controller can start playback once metadata is available,
      // even when its decoder never reports canplaythrough.

      let timelineAdded = false;

      const addTimelineItem = () => {
        if (timelineAdded || !videoRef) return;
        timelineAdded = true;

        timeline = new Timeline('video');

        const child = {
          seek: (time: number) => {
            if (playbackController) {
              playbackController.seek(time);
              return;
            }
            seekingVideoSubscription?.unsubscribe();
            seekingVideoSubscription = seekVideo(time).subscribe(
              (evt) => void 0
            );
          },
          play: (offset: number = 0) => {
            if (playbackController) {
              playbackController.play(offset);
              return;
            }
            // Always seek to the offset before playing (offset is in milliseconds)
            // This is important for looping - when offset is 0, we need to reset to start
            if (videoRef!.readyState >= ReadyState.HAVE_METADATA) {
              const targetTime = offset / 1000;
              videoRef!.currentTime = targetTime;
            }
            playVideo(videoRef!, props.globals.reportError);
          },
          pause: () => {
            if (playbackController) {
              playbackController.pause();
              return;
            }
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
          let readinessTimer: number | undefined;
          let metadataTimer: number | undefined;
          let recovering = false;
          const metadataHandler = () => {
            addTimelineItem();
            if (playbackController) {
              clearTimeout(metadataTimer);
              metadataTimer = window.setTimeout(handler, 1000);
            }
          };

          const handler = () => {
            // Ensure timeline is added (in case canplaythrough fires before/without metadata)
            addTimelineItem();
            subscriber.next('video:loaded');
            subscriber.complete();
          };

          const errorHandler = () => {
            clearTimeout(metadataTimer);
            if (playbackController?.recoverMedia && !recovering) {
              recovering = true;
              clearTimeout(readinessTimer);
              readinessTimer = window.setTimeout(
                () =>
                  subscriber.error(
                    new Error('Timed out recovering video media')
                  ),
                30000
              );
              void playbackController
                .recoverMedia()
                .then((url) => {
                  if (disposed || subscriber.closed) return;
                  if (!url) {
                    subscriber.error(
                      new Error('Failed to recover video media')
                    );
                    return;
                  }
                  videoRef!.src = url;
                  clearTimeout(readinessTimer);
                  readinessTimer = window.setTimeout(
                    () =>
                      subscriber.error(
                        new Error('Timed out loading recovered video metadata')
                      ),
                    15000
                  );
                  videoRef!.load();
                })
                .catch((error: unknown) => subscriber.error(error));
              return;
            }
            subscriber.error(
              videoRef!.error ?? new Error('Video failed to load')
            );
          };

          videoRef!.addEventListener('loadedmetadata', metadataHandler);
          videoRef!.addEventListener('canplaythrough', handler);
          if (playbackController) {
            videoRef!.addEventListener('loadeddata', metadataHandler);
            videoRef!.addEventListener('canplay', handler);
            readinessTimer = window.setTimeout(() => {
              if (videoRef!.readyState >= ReadyState.HAVE_METADATA) {
                handler();
              } else {
                subscriber.error(new Error('Timed out loading video metadata'));
              }
            }, 15000);
          }
          videoRef!.addEventListener('error', errorHandler);

          try {
            videoRef!.load();
          } catch (error) {
            subscriber.error(error);
          }

          return () => {
            clearTimeout(readinessTimer);
            clearTimeout(metadataTimer);
            videoRef!.removeEventListener('loadedmetadata', metadataHandler);
            videoRef!.removeEventListener('canplaythrough', handler);
            if (playbackController) {
              videoRef!.removeEventListener('loadeddata', metadataHandler);
              videoRef!.removeEventListener('canplay', handler);
            }
            videoRef!.removeEventListener('error', errorHandler);
          };
        });
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
          if (playbackController) {
            props.globals.reportError?.({
              category: 'media-load',
              code: 'video-load-failed',
              error: err,
            });
          }
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
        muted={props.globals.muted ?? false}
      ></video>
    </>
  );
};
