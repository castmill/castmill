import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import type { JsonMedia } from '@castmill/player';

import { MediaUpload } from './media-upload';

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
    ...overrides,
  };
  render(() => <MediaUpload {...(props as any)} />);
  return props;
};

const openDialog = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Upload a new image' }));

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uploadProps.current = undefined;
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

  it('reports the uploaded media and closes the dialog', async () => {
    const props = renderUpload();
    openDialog();

    uploadProps.current.onFileUpload('beach.png', media());
    uploadProps.current.onUploadComplete();

    expect(props.onUpload).toHaveBeenCalledWith(media());
    await vi.advanceTimersByTimeAsync(400);
    expect(screen.queryByTestId('upload-component')).toBeNull();
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

  it('ignores late callbacks from a dismissed dialog after reopening', async () => {
    const props = renderUpload();
    openDialog();
    const firstUpload = uploadProps.current;
    firstUpload.onCancel();
    await vi.advanceTimersByTimeAsync(400);

    openDialog();
    const secondUpload = uploadProps.current;
    firstUpload.onFileUpload('stale.png', media({ id: 41 }));
    firstUpload.onUploadComplete();
    expect(props.onUpload).not.toHaveBeenCalled();

    const selected = media({ id: 43 });
    secondUpload.onFileUpload('new.png', selected);
    secondUpload.onUploadComplete();
    expect(props.onUpload).toHaveBeenCalledWith(selected);
    expect(props.onUpload).toHaveBeenCalledTimes(1);
  });

  it('ignores late upload callbacks after unmount', () => {
    const props = renderUpload();
    openDialog();
    const upload = uploadProps.current;
    cleanup();

    upload.onFileUpload('late.png', media());
    upload.onUploadComplete();
    expect(props.onUpload).not.toHaveBeenCalled();
  });
});
