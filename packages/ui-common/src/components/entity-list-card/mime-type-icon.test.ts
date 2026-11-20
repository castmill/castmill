import { describe, expect, it } from 'vitest';
import {
  BsCameraVideo,
  BsFileEarmark,
  BsFileEarmarkCode,
  BsFileEarmarkImage,
  BsFileEarmarkPlay,
  BsImage,
} from 'solid-icons/bs';
import { mimeTypeIcon, mimeTypeLabel } from './mime-type-icon';

describe('mimeTypeIcon', () => {
  it('returns file icons by default and kind glyphs on request', () => {
    expect(mimeTypeIcon('image/png')).toBe(BsFileEarmarkImage);
    expect(mimeTypeIcon('video/mp4')).toBe(BsFileEarmarkPlay);
    expect(mimeTypeIcon('image/png', 'kind')).toBe(BsImage);
    expect(mimeTypeIcon('video/mp4', 'kind')).toBe(BsCameraVideo);
    expect(mimeTypeIcon('application/json')).toBe(BsFileEarmarkCode);
    expect(mimeTypeIcon(undefined)).toBe(BsFileEarmark);
  });

  it('derives short type labels', () => {
    expect(mimeTypeLabel('image/svg+xml')).toBe('SVG');
    expect(mimeTypeLabel('video/x-matroska')).toBe('MATROSKA');
    expect(mimeTypeLabel(null)).toBeUndefined();
  });
});
