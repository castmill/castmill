import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JsonMedia } from '@castmill/player';
import {
  metaDimensions,
  metaDuration,
  probeDimensions,
} from './media-dimensions';

const media = (overrides: Partial<JsonMedia> = {}) =>
  ({
    id: 1,
    mimetype: 'image/jpeg',
    meta: {},
    files: {},
    ...overrides,
  }) as unknown as JsonMedia;

const poster = (mimetype: string) => ({
  poster: { uri: 'https://cdn/poster', mimetype },
});

describe('media metadata', () => {
  it('reads positive dimensions and duration from meta', () => {
    const m = media({ meta: { width: 640, height: 360, duration: 5000 } });
    expect(metaDimensions(m)).toEqual({ width: 640, height: 360 });
    expect(metaDuration(m)).toBe(5000);
  });

  it('ignores missing or invalid values', () => {
    expect(metaDimensions(media({ meta: null }))).toBeUndefined();
    expect(
      metaDimensions(media({ meta: { width: 0, height: 10 } }))
    ).toBeUndefined();
    expect(metaDuration(media({ meta: { duration: 'x' } }))).toBeUndefined();
  });
});

describe('probeDimensions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports undefined without a poster file', () => {
    const onResult = vi.fn();
    probeDimensions(media(), onResult)();
    expect(onResult).toHaveBeenCalledWith(undefined);
  });

  it('reads the natural size of image posters', () => {
    const onResult = vi.fn();
    const created: HTMLImageElement[] = [];
    const RealImage = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(() => {
      const img = new RealImage();
      created.push(img);
      return img;
    });

    probeDimensions(media({ files: poster('image/jpeg') as any }), onResult);
    const img = created[0];
    expect(img.src).toBe('https://cdn/poster');
    Object.defineProperty(img, 'naturalWidth', { value: 1920 });
    Object.defineProperty(img, 'naturalHeight', { value: 1080 });
    img.onload!(new Event('load'));
    img.onload?.(new Event('load'));

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ width: 1920, height: 1080 });
    expect(img.getAttribute('src')).toBeNull();
  });

  it('reads video metadata and reports errors as undefined', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const createElement = document.createElement.bind(document);
    const videos: HTMLVideoElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, options?: ElementCreationOptions) => {
        const el = createElement(tag, options);
        if (tag === 'video') videos.push(el as HTMLVideoElement);
        return el;
      }
    );

    const ok = vi.fn();
    probeDimensions(
      media({ mimetype: 'video/mp4', files: poster('video/mp4') as any }),
      ok
    );
    const video = videos[0];
    expect(video.preload).toBe('metadata');
    Object.defineProperty(video, 'videoWidth', { value: 1280 });
    Object.defineProperty(video, 'videoHeight', { value: 720 });
    video.onloadedmetadata!(new Event('loadedmetadata'));
    expect(ok).toHaveBeenCalledWith({ width: 1280, height: 720 });
    expect(video.onloadedmetadata).toBeNull();

    const failed = vi.fn();
    probeDimensions(
      media({ mimetype: 'video/mp4', files: poster('') as any }),
      failed
    );
    videos[1].onerror!(new Event('error'));
    expect(failed).toHaveBeenCalledWith(undefined);
  });

  it('never reports after being cancelled', () => {
    const onResult = vi.fn();
    const created: HTMLImageElement[] = [];
    const RealImage = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(() => {
      const img = new RealImage();
      created.push(img);
      return img;
    });

    const cancel = probeDimensions(
      media({ files: poster('image/png') as any }),
      onResult
    );
    const img = created[0];
    const onload = img.onload!;
    cancel();
    cancel();
    onload.call(img, new Event('load'));
    expect(img.onload).toBeNull();
    expect(onResult).not.toHaveBeenCalled();
  });
});
