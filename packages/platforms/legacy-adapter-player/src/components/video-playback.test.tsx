import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { Cache, ResourceManager, StorageDummy } from '@castmill/cache';
import { Video } from '../../../../player/src/widgets/template/video';
import { Timeline } from '../../../../player/src/widgets/template/timeline';
import { Layout } from '../../../../player/src/widgets/template/layout';
import { TemplateComponentType } from '../../../../player/src/widgets/template/template';
import type { JsonPlaylist } from '../../../../player/src/interfaces/json-playlist.interface';
import { createWebosVideoPlayback } from '../classes/webos-video-playback';
import type {
  VideoPlaybackController,
  VideoPlaybackControllerFactory,
} from '../../../../player/src/interfaces/player-globals.interface';

describe('Video playback integration', () => {
  let dispose: () => void;
  let container: HTMLDivElement;
  let timeline: Timeline;
  const controller = (): VideoPlaybackController => ({
    seek: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    dispose: vi.fn(),
  });

  beforeEach(() => {
    timeline = new Timeline('test');
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(
      4
    );
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(12);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      () => undefined!
    );
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    timeline.pause();
    dispose?.();
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mount = async (factory?: VideoPlaybackControllerFactory) => {
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue(
      'https://media.test/video.mp4'
    );
    const ready = vi.fn();
    dispose = render(
      () => (
        <Video
          name="test"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{
            target: 'preview',
            createVideoPlaybackController: factory,
          }}
          onReady={ready}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    return container.querySelector('video')!;
  };

  it('keeps default seeking and legacy play() return behavior without a factory', async () => {
    const video = await mount();
    const child = timeline.items[0].child;
    child.seek(2000);
    expect(video.currentTime).toBe(2);
    child.play(4000);
    expect(video.currentTime).toBe(4);
    expect(video.play).toHaveBeenCalledOnce();
    child.pause();
    expect(video.pause).toHaveBeenCalledOnce();
  });

  it('still waits for canplaythrough without a WebOS controller', async () => {
    let readyState = 0;
    vi.spyOn(
      HTMLMediaElement.prototype,
      'readyState',
      'get'
    ).mockImplementation(() => readyState);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
      function (this: HTMLMediaElement) {
        readyState = 1;
        this.dispatchEvent(new Event('loadedmetadata'));
      }
    );
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue('blob:video');
    const ready = vi.fn();
    dispose = render(
      () => (
        <Video
          name="default"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{ target: 'preview' }}
          onReady={ready}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(timeline.items).toHaveLength(1));
    expect(ready).not.toHaveBeenCalled();
    container
      .querySelector('video')!
      .dispatchEvent(new Event('canplaythrough'));
    expect(ready).toHaveBeenCalledOnce();
  });

  it('delegates timeline operations exclusively to the per-element controller', async () => {
    const integration = controller();
    const factory = vi.fn(
      (
        _video: HTMLVideoElement,
        _context: Parameters<VideoPlaybackControllerFactory>[1]
      ) => integration
    );
    const video = await mount(factory);
    expect(factory).toHaveBeenCalledWith(
      video,
      expect.objectContaining({
        reportError: undefined,
        refreshMedia: expect.any(Function),
      })
    );
    const child = timeline.items[0].child;
    for (let i = 0; i < 5; i++) {
      child.seek(1000);
      child.play(1000);
      child.pause();
    }
    expect(integration.seek).toHaveBeenCalledTimes(5);
    expect(integration.play).toHaveBeenCalledTimes(5);
    expect(integration.pause).toHaveBeenCalledTimes(5);
    expect(video.currentTime).toBe(0);
    expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
    expect(child.duration()).toBe(12000);
    dispose();
    expect(integration.dispose).toHaveBeenCalledOnce();
  });

  it('unblocks WebOS playback when metadata arrives without canplaythrough', async () => {
    let readyState = 0;
    vi.spyOn(
      HTMLMediaElement.prototype,
      'readyState',
      'get'
    ).mockImplementation(() => readyState);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
      function (this: HTMLMediaElement) {
        readyState = 1;
        this.dispatchEvent(new Event('loadedmetadata'));
      }
    );
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue('blob:video');
    const ready = vi.fn();
    const integration = controller();
    dispose = render(
      () => (
        <Video
          name="webos"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{
            target: 'poster',
            createVideoPlaybackController: () => integration,
          }}
          onReady={ready}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce(), {
      timeout: 2000,
    });
    expect(timeline.items).toHaveLength(1);
    timeline.items[0].child.play(2000);
    expect(integration.play).toHaveBeenCalledWith(2000);
  });

  it('registers WebOS videos when loadeddata is the only readiness event', async () => {
    let readyState = 0;
    vi.spyOn(
      HTMLMediaElement.prototype,
      'readyState',
      'get'
    ).mockImplementation(() => readyState);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
      function (this: HTMLMediaElement) {
        readyState = 2;
        this.dispatchEvent(new Event('loadeddata'));
      }
    );
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue('blob:video');
    const ready = vi.fn();
    const integration = controller();
    dispose = render(
      () => (
        <Video
          name="webos"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{
            target: 'poster',
            createVideoPlaybackController: () => integration,
          }}
          onReady={ready}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce(), {
      timeout: 2000,
    });
    expect(timeline.items).toHaveLength(1);
    timeline.items[0].child.play(2000);
    expect(integration.play).toHaveBeenCalledWith(2000);
  });

  it('registers WebOS videos when readyState advances without events', async () => {
    let readyState = 0;
    vi.spyOn(
      HTMLMediaElement.prototype,
      'readyState',
      'get'
    ).mockImplementation(() => readyState);
    const load = vi
      .spyOn(HTMLMediaElement.prototype, 'load')
      .mockImplementation(() => {
        readyState = 1;
      });
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue('blob:video');
    const ready = vi.fn();
    const integration = controller();
    vi.useFakeTimers();
    dispose = render(
      () => (
        <Video
          name="webos"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{
            target: 'poster',
            createVideoPlaybackController: () => integration,
          }}
          onReady={ready}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(ready).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(ready).toHaveBeenCalledOnce();
    expect(timeline.items).toHaveLength(1);
    timeline.items[0].child.play(2000);
    expect(integration.play).toHaveBeenCalledWith(2000);
  });

  it('redownloads a missing native video once before declaring it ready', async () => {
    let readyState = 0;
    let loads = 0;
    vi.spyOn(
      HTMLMediaElement.prototype,
      'readyState',
      'get'
    ).mockImplementation(() => readyState);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
      function (this: HTMLMediaElement) {
        if (++loads === 1) {
          this.dispatchEvent(new Event('error'));
        } else {
          readyState = 2;
          this.dispatchEvent(new Event('loadedmetadata'));
          this.dispatchEvent(new Event('canplay'));
        }
      }
    );
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    const original = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    const replacement = `http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`;
    vi.spyOn(resources, 'getMedia').mockResolvedValue(original);
    const refresh = vi
      .spyOn(resources, 'refreshMedia')
      .mockResolvedValue(replacement);
    const ready = vi.fn();
    dispose = render(
      () => (
        <Video
          name="webos"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{
            target: 'poster',
            createVideoPlaybackController: createWebosVideoPlayback,
          }}
          onReady={ready}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(refresh).toHaveBeenCalledOnce();
    expect(loads).toBe(2);
    expect(container.querySelector('video')!.src).toBe(replacement);
    expect(timeline.items).toHaveLength(1);
  });

  it.each([
    'http://127.0.0.1:9080/castmill-cache/video.mp4',
    'blob:http://castmill.test/video',
    'https://media.test/video.mp4',
  ])(
    'replays a rendered WebOS video without classifying its URL: %s',
    async (url) => {
      const resources = new ResourceManager(
        new Cache(new StorageDummy('test'), 'test', 10)
      );
      vi.spyOn(resources, 'getMedia').mockResolvedValue(url);
      const ready = vi.fn();
      dispose = render(
        () => (
          <Video
            name="webos"
            opts={{ url, size: 'contain' }}
            style={{}}
            timeline={timeline}
            resourceManager={resources}
            globals={{
              target: 'poster',
              createVideoPlaybackController: createWebosVideoPlayback,
            }}
            onReady={ready}
          />
        ),
        container
      );
      await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
      const video = container.querySelector('video')!;
      const load = vi.spyOn(video, 'load').mockImplementation(() => {
        video.currentTime = 0;
        video.dispatchEvent(new Event('loadedmetadata'));
      });
      for (let i = 0; i < 5; i++) {
        timeline.seek(0);
        timeline.play(0);
        await vi.waitFor(() => expect(video.play).toHaveBeenCalledTimes(i + 1));
        timeline.pause();
        video.currentTime = 12;
      }
      expect(load).toHaveBeenCalledTimes(4);
    }
  );

  it('does not create a controller after disposal during media retrieval', async () => {
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    let resolveMedia!: (url: string) => void;
    const media = new Promise<string>((resolve) => {
      resolveMedia = resolve;
    });
    const getMedia = vi.spyOn(resources, 'getMedia').mockReturnValue(media);
    const factory = vi.fn(() => controller());
    dispose = render(
      () => (
        <Video
          name="pending"
          opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{ target: 'poster', createVideoPlaybackController: factory }}
          onReady={() => {}}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(getMedia).toHaveBeenCalledOnce());
    dispose();
    resolveMedia('blob:http://castmill.test/video');
    await media;
    expect(factory).not.toHaveBeenCalled();
    expect(timeline.items).toHaveLength(0);
  });

  it('creates and disposes separate controllers for simultaneous videos', async () => {
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue(
      'https://media.test/video.mp4'
    );
    const instances: VideoPlaybackController[] = [];
    const factory: VideoPlaybackControllerFactory = () => {
      const instance = controller();
      instances.push(instance);
      return instance;
    };
    dispose = render(
      () => (
        <>
          {['first', 'second'].map((name) => (
            <Video
              name={name}
              opts={{ url: 'https://media.test/video.mp4', size: 'contain' }}
              style={{}}
              timeline={timeline}
              resourceManager={resources}
              globals={{
                target: 'poster',
                createVideoPlaybackController: factory,
              }}
              onReady={() => {}}
            />
          ))}
        </>
      ),
      container
    );
    await vi.waitFor(() => expect(instances).toHaveLength(2));
    expect(instances[0]).not.toBe(instances[1]);
    timeline.items[0].child.play(1000);
    expect(instances[0].play).toHaveBeenCalledWith(1000);
    expect(instances[1].play).not.toHaveBeenCalled();
    dispose();
    instances.forEach((instance) =>
      expect(instance.dispose).toHaveBeenCalledOnce()
    );
  });

  it('propagates the controller through nested playlist layouts', async () => {
    const resources = new ResourceManager(
      new Cache(new StorageDummy('test'), 'test', 10)
    );
    vi.spyOn(resources, 'getMedia').mockResolvedValue(
      'https://media.test/video.mp4'
    );
    const factory = vi.fn(
      (
        _video: HTMLVideoElement,
        _context: Parameters<VideoPlaybackControllerFactory>[1]
      ) => controller()
    );
    const playlist: JsonPlaylist = {
      id: 1,
      name: 'nested',
      status: 'live',
      items: [
        {
          id: 1,
          name: 'video',
          duration: 12000,
          offset: 0,
          slack: 0,
          config: { widget_id: 1, options: {}, data: {} },
          widget: {
            name: 'video',
            template: {
              type: TemplateComponentType.Video,
              name: 'video',
              opts: { url: 'https://media.test/video.mp4', size: 'contain' },
            },
          },
        },
      ],
    };
    dispose = render(
      () => (
        <Layout
          name="outer"
          opts={{ containers: [{ playlist, style: {} }] }}
          style={{}}
          timeline={timeline}
          resourceManager={resources}
          globals={{ target: 'poster', createVideoPlaybackController: factory }}
          onReady={() => {}}
        />
      ),
      container
    );
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
    expect(factory.mock.calls[0][0]).toBe(container.querySelector('video'));
  });
});
