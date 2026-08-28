import { describe, expect, it } from 'vitest';
import { getThumbnailProgress } from './thumbnail-status';

describe('getThumbnailProgress', () => {
  it('shows queued uploads at zero progress instead of as failures', () => {
    expect(
      getThumbnailProgress({ status: 'uploading', status_message: null })
    ).toBe(0);
  });

  it('uses the reported transcoding progress', () => {
    expect(
      getThumbnailProgress({ status: 'transcoding', status_message: '46' })
    ).toBe(46);
  });

  it('clamps reported progress to the supported range', () => {
    expect(
      getThumbnailProgress({ status: 'transcoding', status_message: '-1' })
    ).toBe(0);
    expect(
      getThumbnailProgress({ status: 'transcoding', status_message: '101' })
    ).toBe(100);
  });

  it('shows active transcoding with a non-numeric message at zero progress', () => {
    expect(
      getThumbnailProgress({
        status: 'transcoding',
        status_message: 'Transcoding started',
      })
    ).toBe(0);
  });

  it('does not show progress for failed media', () => {
    expect(
      getThumbnailProgress({ status: 'failed', status_message: 'ffmpeg error' })
    ).toBeNull();
  });
});
