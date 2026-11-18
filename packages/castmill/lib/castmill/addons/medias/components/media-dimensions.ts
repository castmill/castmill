import { JsonMedia } from '@castmill/player';

export interface MediaDimensions {
  width: number;
  height: number;
}

const positive = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

const toDimensions = (width: unknown, height: unknown) => {
  const w = positive(width);
  const h = positive(height);
  return w && h ? { width: w, height: h } : undefined;
};

/** Dimensions stored in the media metadata, if any. */
export const metaDimensions = (media: JsonMedia): MediaDimensions | undefined =>
  toDimensions(media.meta?.width, media.meta?.height);

/** Duration in milliseconds stored in the media metadata, if any. */
export const metaDuration = (media: JsonMedia): number | undefined =>
  positive(media.meta?.duration);

/**
 * Reads the dimensions of the media's playback ("poster") file in the
 * browser. Only the image, or the video metadata, is downloaded.
 * Returns a function that cancels the probe; `onResult` is never called after
 * cancelling.
 */
export const probeDimensions = (
  media: JsonMedia,
  onResult: (dimensions: MediaDimensions | undefined) => void
): (() => void) => {
  const file = media.files?.['poster'];
  if (!file?.uri) {
    onResult(undefined);
    return () => {};
  }

  const mimetype = file.mimetype || media.mimetype || '';
  let settled = false;
  let release = () => {};

  const finish = (width?: number, height?: number) => {
    if (settled) return;
    settled = true;
    release();
    onResult(toDimensions(width, height));
  };

  if (mimetype.startsWith('video/')) {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => finish(video.videoWidth, video.videoHeight);
    video.onerror = () => finish();
    release = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };
    video.src = file.uri;
  } else {
    const image = new Image();
    image.onload = () => finish(image.naturalWidth, image.naturalHeight);
    image.onerror = () => finish();
    release = () => {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
    };
    image.src = file.uri;
  }

  return () => {
    if (settled) return;
    settled = true;
    release();
  };
};
