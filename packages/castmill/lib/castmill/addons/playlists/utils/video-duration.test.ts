import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonWidgetTemplate } from '@castmill/player';
import {
  findVideoOptionKeys,
  probeVideoDuration,
  resolveVideoWidgetDuration,
} from './video-duration';

const videoTemplate = (key = 'options.video.files[@target].uri') =>
  ({
    type: 'video',
    name: 'video',
    opts: { url: { key } },
  }) as unknown as JsonWidgetTemplate;

const media = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'clip.mp4',
  mimetype: 'video/mp4',
  status: 'ready',
  meta: null,
  files: {
    preview: { uri: 'https://cdn.example/preview.mp4', mimetype: 'video/mp4' },
    thumbnail: { uri: 'https://cdn.example/thumb.jpg', mimetype: 'image/jpeg' },
  },
  ...overrides,
});

describe('findVideoOptionKeys', () => {
  it('returns the option bound to a video component', () => {
    expect(findVideoOptionKeys(videoTemplate())).toEqual(['video']);
  });

  it('finds videos inside groups', () => {
    const template = {
      type: 'group',
      name: 'group',
      opts: {},
      components: [
        { type: 'text', name: 'title', opts: {} },
        videoTemplate('options.clip.files[@target].uri'),
      ],
    } as unknown as JsonWidgetTemplate;
    expect(findVideoOptionKeys(template)).toEqual(['clip']);
  });

  it('ignores videos whose length does not define the widget', () => {
    const template = {
      type: 'scroller',
      name: 'scroller',
      opts: {},
      component: videoTemplate(),
    } as unknown as JsonWidgetTemplate;
    expect(findVideoOptionKeys(template)).toEqual([]);
    expect(findVideoOptionKeys(null)).toEqual([]);
    expect(
      findVideoOptionKeys({
        type: 'video',
        name: 'video',
        opts: { url: 'https://cdn.example/fixed.mp4' },
      } as unknown as JsonWidgetTemplate)
    ).toEqual([]);
  });
});

describe('resolveVideoWidgetDuration', () => {
  it('uses the duration stored on the media', async () => {
    const probe = vi.fn();
    const duration = await resolveVideoWidgetDuration(
      videoTemplate(),
      { video: media({ meta: { duration: 12345.6 } }) },
      probe
    );
    expect(duration).toBe(12346);
    expect(probe).not.toHaveBeenCalled();
  });

  it('probes the video file when the media has no stored duration', async () => {
    const probe = vi.fn().mockResolvedValue(13967);
    const duration = await resolveVideoWidgetDuration(
      videoTemplate(),
      { video: media() },
      probe
    );
    expect(duration).toBe(13967);
    expect(probe).toHaveBeenCalledWith('https://cdn.example/preview.mp4');
  });

  it('falls back to any video file when no known context exists', async () => {
    const probe = vi.fn().mockResolvedValue(5000);
    await resolveVideoWidgetDuration(
      videoTemplate(),
      {
        video: media({
          files: {
            hd: { uri: 'https://cdn.example/hd.mp4', mimetype: 'video/mp4' },
          },
        }),
      },
      probe
    );
    expect(probe).toHaveBeenCalledWith('https://cdn.example/hd.mp4');
  });

  it('returns undefined when the duration is unknown', async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    expect(
      await resolveVideoWidgetDuration(
        videoTemplate(),
        { video: media() },
        probe
      )
    ).toBeUndefined();
    expect(
      await resolveVideoWidgetDuration(videoTemplate(), { video: 42 }, probe)
    ).toBeUndefined();
    expect(
      await resolveVideoWidgetDuration(
        videoTemplate(),
        { video: media({ files: {} }) },
        probe
      )
    ).toBeUndefined();
  });

  it('uses the longest video of a group', async () => {
    const template = {
      type: 'group',
      name: 'group',
      opts: {},
      components: [
        videoTemplate('options.a.files[@target].uri'),
        videoTemplate('options.b.files[@target].uri'),
      ],
    } as unknown as JsonWidgetTemplate;
    const duration = await resolveVideoWidgetDuration(template, {
      a: media({ meta: { duration: 8000 } }),
      b: media({ meta: { duration: 11979 } }),
    });
    expect(duration).toBe(11979);
  });
});

describe('probeVideoDuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const captureVideo = () => {
    const createElement = document.createElement.bind(document);
    let video: HTMLVideoElement | undefined;
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        const element = createElement(tag, options);
        if (tag === 'video') {
          video = element as HTMLVideoElement;
          vi.spyOn(video, 'load').mockImplementation(() => {});
        }
        return element;
      }
    );
    return () => video!;
  };

  it('resolves the metadata duration in ms and releases the source', async () => {
    const getVideo = captureVideo();
    const promise = probeVideoDuration('https://cdn.example/clip.mp4');
    const video = getVideo();
    expect(video.preload).toBe('metadata');
    Object.defineProperty(video, 'duration', { value: 11.979 });
    video.dispatchEvent(new Event('loadedmetadata'));

    expect(await promise).toBe(11979);
    expect(video.getAttribute('src')).toBeNull();
  });

  it('resolves undefined on error or invalid duration', async () => {
    const getVideo = captureVideo();
    const failed = probeVideoDuration('https://cdn.example/missing.mp4');
    getVideo().dispatchEvent(new Event('error'));
    expect(await failed).toBeUndefined();

    const infinite = probeVideoDuration('https://cdn.example/live.mp4');
    Object.defineProperty(getVideo(), 'duration', { value: Infinity });
    getVideo().dispatchEvent(new Event('loadedmetadata'));
    expect(await infinite).toBeUndefined();
  });

  it('resolves undefined when metadata never loads', async () => {
    vi.useFakeTimers();
    captureVideo();
    const promise = probeVideoDuration('https://cdn.example/slow.mp4', 1000);
    vi.advanceTimersByTime(1000);
    expect(await promise).toBeUndefined();
  });
});
