import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import type { JsonMedia } from '@castmill/player';

import {
  MediaUpload,
  MEDIA_POLL_INTERVAL_MS,
  MEDIA_POLL_MAX_ATTEMPTS,
} from './media-upload';
import { ResourcesService } from '../services/resources.service';

// The dialog animates its size with a ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

const uploadProps = vi.hoisted(() => ({ current: undefined as any }));

vi.mock('../../medias/components/upload', () => ({
  UploadComponent: (props: any) => {
    uploadProps.current = props;
    return <div data-testid="upload-component" />;
  },
}));

vi.mock('../services/resources.service', () => ({
  ResourcesService: { get: vi.fn() },
}));

const media = (overrides: Partial<JsonMedia> = {}) =>
  ({
    id: 42,
    name: 'beach',
    mimetype: 'image/png',
    status: 'uploading',
    status_message: null,
    meta: {},
    files: {},
    inserted_at: '',
    updated_at: '',
    ...overrides,
  }) as JsonMedia;

const store = {
  i18n: { t: (key: string) => key, locale: () => 'en' },
} as any;

const renderUpload = (overrides: Record<string, unknown> = {}) => {
  const props = {
    store,
    baseUrl: 'http://localhost:4000',
    organizationId: 'org-1',
    mediaType: 'image',
    label: 'Upload a new image',
    onUpload: vi.fn(),
    onProcessed: vi.fn(),
    ...overrides,
  };
  render(() => <MediaUpload {...(props as any)} />);
  return props;
};

const openDialog = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Upload a new image' }));

const getMock = vi.mocked(ResourcesService.get);

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uploadProps.current = undefined;
    getMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens an upload dialog limited to one file of the media type', () => {
    renderUpload();

    expect(screen.queryByTestId('upload-component')).toBeNull();
    openDialog();

    expect(screen.getByTestId('upload-component')).toBeInTheDocument();
    expect(
      screen.getByText('playlists.mediaUpload.description')
    ).toBeInTheDocument();
    expect(uploadProps.current.mediaType).toBe('image');
    expect(uploadProps.current.multiple).toBe(false);
    expect(uploadProps.current.organizationId).toBe('org-1');
  });

  it('reports the uploaded media, closes and refreshes it once processed', async () => {
    const props = renderUpload();
    openDialog();

    uploadProps.current.onFileUpload('beach.png', media());
    uploadProps.current.onUploadComplete();

    expect(props.onUpload).toHaveBeenCalledWith(media());
    await vi.advanceTimersByTimeAsync(400);
    expect(screen.queryByTestId('upload-component')).toBeNull();

    getMock.mockResolvedValueOnce(media({ status: 'transcoding' }));
    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS);
    expect(getMock).toHaveBeenCalledWith(
      'http://localhost:4000',
      'org-1',
      'medias',
      42
    );
    expect(props.onProcessed).not.toHaveBeenCalled();

    getMock.mockRejectedValueOnce(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    const ready = media({
      status: 'ready',
      files: { thumbnail: { uri: 'thumb.png' } as any },
    });
    getMock.mockResolvedValueOnce(ready);
    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS);
    expect(props.onProcessed).toHaveBeenCalledWith(ready);

    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS * 3);
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it('does not poll a media that is already processed', async () => {
    const props = renderUpload();
    openDialog();

    uploadProps.current.onFileUpload('beach.png', media({ status: 'ready' }));
    uploadProps.current.onUploadComplete();

    expect(props.onUpload).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS * 2);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('keeps the dialog open when nothing was uploaded', async () => {
    const props = renderUpload();
    openDialog();

    uploadProps.current.onUploadComplete();
    await vi.advanceTimersByTimeAsync(400);

    expect(props.onUpload).not.toHaveBeenCalled();
    expect(screen.getByTestId('upload-component')).toBeInTheDocument();
  });

  it('closes the dialog when the upload is cancelled', async () => {
    const props = renderUpload();
    openDialog();

    uploadProps.current.onCancel();
    await vi.advanceTimersByTimeAsync(400);

    expect(screen.queryByTestId('upload-component')).toBeNull();
    expect(props.onUpload).not.toHaveBeenCalled();
  });

  it('gives up after the maximum number of checks', async () => {
    const props = renderUpload();
    openDialog();
    getMock.mockResolvedValue(media({ status: 'transcoding' }));

    uploadProps.current.onFileUpload('beach.png', media());
    uploadProps.current.onUploadComplete();
    await vi.advanceTimersByTimeAsync(
      MEDIA_POLL_INTERVAL_MS * (MEDIA_POLL_MAX_ATTEMPTS + 5)
    );

    expect(getMock).toHaveBeenCalledTimes(MEDIA_POLL_MAX_ATTEMPTS);
    expect(props.onProcessed).not.toHaveBeenCalled();
  });

  it('stops checking the media when unmounted', async () => {
    renderUpload();
    openDialog();

    uploadProps.current.onFileUpload('beach.png', media());
    uploadProps.current.onUploadComplete();
    cleanup();

    await vi.advanceTimersByTimeAsync(MEDIA_POLL_INTERVAL_MS * 2);
    expect(getMock).not.toHaveBeenCalled();
  });
});
