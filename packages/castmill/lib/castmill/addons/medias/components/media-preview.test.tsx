import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@solidjs/testing-library';
import type { JsonMedia } from '@castmill/player';
import { MediaPreview } from './media-preview';

const media = (preview?: { uri: string; mimetype: string }) =>
  ({
    id: 1,
    name: 'Sunset',
    files: preview ? { preview } : {},
  }) as unknown as JsonMedia;

describe('MediaPreview', () => {
  afterEach(cleanup);

  it('shows a localized placeholder without a preview file', () => {
    render(() => <MediaPreview media={media()} t={(key) => `t:${key}`} />);
    expect(screen.getByText('t:medias.details.noPreview')).toBeInTheDocument();
  });

  it('falls back to the key without a translation function', () => {
    render(() => <MediaPreview media={media()} previewClass="extra" />);
    const placeholder = screen.getByText('medias.details.noPreview');
    expect(placeholder.parentElement).toHaveClass('preview', 'extra');
  });

  it('renders image previews as a contained img', () => {
    render(() => (
      <MediaPreview
        media={media({ uri: 'https://cdn/x.jpg', mimetype: 'image/jpeg' })}
      />
    ));
    const img = screen.getByRole('img', { name: 'Sunset' });
    expect(img).toHaveAttribute('src', 'https://cdn/x.jpg');
    expect(img).toHaveClass('preview-media');
  });

  it('renders video previews with controls', () => {
    render(() => (
      <MediaPreview
        media={media({ uri: 'https://cdn/x.mp4', mimetype: 'video/mp4' })}
      />
    ));
    const video = document.querySelector('video')!;
    expect(video).toHaveAttribute('src', 'https://cdn/x.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveClass('preview-media');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
