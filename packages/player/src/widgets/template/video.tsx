import { Component, JSX, mergeProps, onCleanup, onMount } from 'solid-js'
import { TemplateConfig, resolveOption } from './binding'
import {
  Observable,
  Subscription,
  fromEvent,
  map,
  of,
  take,
  timeout,
} from 'rxjs'
import { TemplateComponent, TemplateComponentType } from './template'
import { Timeline, TimelineItem } from './timeline'
import { ComponentAnimation } from './animation'
import { BaseComponentProps } from './interfaces/base-component-props'
import { ResourceManager } from '@castmill/cache'
import { PlayerGlobals } from '../../interfaces/player-globals.interface'

enum ReadyState {
  HAVE_NOTHING = 0, // No information is available about the media resource.
  HAVE_METADATA = 1, //	Enough of the media resource has been retrieved that the metadata attributes are initialized. Seeking will no longer raise an exception.
  HAVE_CURRENT_DATA = 2, // Data is available for the current playback position, but not enough to actually play more than one frame.
  HAVE_FUTURE_DATA = 3, // Data for the current playback position as well as for at least a little bit of time into the future is available (in other words, at least two frames of video, for example).
  HAVE_ENOUGH_DATA = 4, // Enough data is available—and the download rate is high enough—that the media can be played through to the end without interruption.
}

export interface VideoComponentOptions {
  url: string
  size: 'cover' | 'contain'
}

export class VideoComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Video

  constructor(
    public name: string,
    public opts: VideoComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration_old(medias: { [index: string]: string }): Observable<number> {
    const videoUrl = medias[this.opts.url]

    if (!videoUrl) {
      throw new Error(`Video ${this.opts.url} not found in medias`)
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = videoUrl

    return fromEvent(video, 'durationchange').pipe(
      take(1),
      map((evt) => {
        const duration = (video?.duration ?? 0) * 1000
        video.src = ''
        return duration
      })
    )
  }

  resolveDuration(medias: { [index: string]: string }): number {
    // TODO: medias should include the duration of the video.
    return 17000
  }

  static fromJSON(json: any): VideoComponent {
    return new VideoComponent(
      json.name,
      json.opts,
      json.style,
      json.animations,
      json.filter
    )
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
    }
  }
}

interface VideoProps extends BaseComponentProps {
  opts: VideoComponentOptions
  resourceManager: ResourceManager
}

export const Video: Component<VideoProps> = (props) => {
  let videoRef: HTMLVideoElement | undefined

  let timeline: Timeline
  let timelineItem: TimelineItem

  const merged = mergeProps(
    {
      width: '100%',
      height: '100%',
    },
    props.style
  )

  let loadingSubscription: Subscription
  let seekingVideoSubscription: Subscription

  onCleanup(() => {
    seekingVideoSubscription?.unsubscribe()
    loadingSubscription?.unsubscribe()
    props.timeline.remove(timelineItem)
    // timeline?.kill();
  })

  onMount(async () => {
    if (videoRef) {
      const videoUrl = await props.resourceManager.getMedia(props.opts.url)
      if (!videoUrl) {
        throw new Error(`Video ${props.opts.url} not found in medias`)
      }

      videoRef.src = videoUrl

      seekingVideoSubscription?.unsubscribe()

      const seekVideo = (time: number): Observable<[number, number]> => {
        if (videoRef && videoRef.readyState >= ReadyState.HAVE_METADATA) {
          videoRef.currentTime = time

          const slow$ = of([time, 0])

          return fromEvent(videoRef, 'seeked').pipe(
            take(1),
            // Timeout for slow or video tags not implementing seeked event.
            timeout({
              each: 500,
              with: () => slow$,
            }),
            map((evt) => [time, 0])
          )
        }
        return of([time, 0])
      }

      loadingSubscription?.unsubscribe()

      let loading$: Observable<string>
      if (videoRef.readyState < ReadyState.HAVE_ENOUGH_DATA) {
        loading$ = new Observable<string>((subscriber) => {
          const handler = (ev: Event) => {
            subscriber.next('video:loaded')
            subscriber.complete()
          }

          const errorHandler = (ev: Event) => {
            subscriber.error('error')
          }

          videoRef!.addEventListener('canplaythrough', handler)
          videoRef!.addEventListener('error', errorHandler)

          return () => {
            videoRef!.removeEventListener('canplaythrough', handler)
            videoRef!.removeEventListener('error', errorHandler)
          }
        })
        videoRef.load()
      } else {
        loading$ = of('vide0:loaded')
      }

      loadingSubscription = loading$.subscribe((ev) => {
        timeline = new Timeline('video')

        const child = {
          seek: (time: number) => {
            seekingVideoSubscription?.unsubscribe()
            seekingVideoSubscription = seekVideo(time).subscribe(
              (evt) => void 0
            )
          },
          play: () => {
            videoRef!.play()
          },
          pause: () => {
            videoRef!.pause()
          },
          duration: () => {
            return videoRef!.duration * 1000
          },
        }

        timelineItem = {
          start: props.timeline.duration(),
          duration: videoRef!.duration * 1000,
          child,
        }
        props.timeline.add(timelineItem)

        props.onReady()
      })

      videoRef.onended = () => {
        props.timeline.pause()
      }
    }
  })

  return (
    <video
      ref={videoRef}
      data-component="video"
      data-name={props.name}
      style={merged}
      loop
      playsinline
    ></video>
  )
}
