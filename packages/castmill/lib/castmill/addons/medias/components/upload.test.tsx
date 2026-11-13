import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import {
  UploadComponent,
  partitionSupportedFiles,
  resolveSupportedFile,
} from './upload';

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@castmill/ui-common', () => ({
  Button: (props: any) => (
    <button disabled={props.disabled} onClick={props.onClick}>
      {props.label}
    </button>
  ),
  IconButton: (props: any) => (
    <button disabled={props.disabled} onClick={props.onClick} />
  ),
  IconWrapper: () => <span>ok</span>,
  useToast: () => toastMock,
  formatBytes: (value: number) => `${value} B`,
}));

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  dropTargetForExternal: vi.fn(() => () => {}),
}));

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];

  upload = {
    onprogress: null as ((event: ProgressEvent) => void) | null,
  };

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  statusText = '';
  withCredentials = false;

  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }

  triggerLoad(status: number, responseText: string, statusText = '') {
    this.status = status;
    this.responseText = responseText;
    this.statusText = statusText;
    this.onload?.();
  }

  triggerError() {
    this.onerror?.();
  }

  triggerAbort() {
    this.onabort?.();
  }
}

describe('UploadComponent', () => {
  const setFilesOnInput = (files: File[]) => {
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: files,
      configurable: true,
    });
    fireEvent.change(input);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockXMLHttpRequest.instances = [];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    vi.stubGlobal(
      'XMLHttpRequest',
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables upload immediately and ignores a second click while uploading', async () => {
    render(() => (
      <UploadComponent baseUrl="http://test.local" organizationId="org-1" />
    ));

    setFilesOnInput([new File(['data'], 'image.png', { type: 'image/png' })]);
    const uploadButton = screen.getByRole('button', {
      name: 'medias.upload.upload',
    });

    fireEvent.click(uploadButton);
    fireEvent.click(uploadButton);

    await waitFor(() => expect(uploadButton).toBeDisabled());
    expect(MockXMLHttpRequest.instances).toHaveLength(1);
  });

  it('completes upload batch after mixed success, http error, and network error responses', async () => {
    const onUploadComplete = vi.fn();

    render(() => (
      <UploadComponent
        baseUrl="http://test.local"
        organizationId="org-1"
        onUploadComplete={onUploadComplete}
      />
    ));

    setFilesOnInput([
      new File(['a'], 'first.png', { type: 'image/png' }),
      new File(['b'], 'second.png', { type: 'image/png' }),
      new File(['c'], 'third.png', { type: 'image/png' }),
    ]);

    const uploadButton = screen.getByRole('button', {
      name: 'medias.upload.upload',
    });
    fireEvent.click(uploadButton);

    await waitFor(() => expect(uploadButton).toBeDisabled());
    expect(MockXMLHttpRequest.instances).toHaveLength(3);

    MockXMLHttpRequest.instances[0].triggerLoad(200, '{"id":"media-1"}');
    MockXMLHttpRequest.instances[1].triggerLoad(
      500,
      '{"error":"failed"}',
      'Internal Server Error'
    );
    MockXMLHttpRequest.instances[2].triggerError();

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
  });

  it('completes upload batch when upload is aborted', async () => {
    const onUploadComplete = vi.fn();

    render(() => (
      <UploadComponent
        baseUrl="http://test.local"
        organizationId="org-1"
        onUploadComplete={onUploadComplete}
      />
    ));

    setFilesOnInput([new File(['data'], 'video.mp4', { type: 'video/mp4' })]);
    const uploadButton = screen.getByRole('button', {
      name: 'medias.upload.upload',
    });

    fireEvent.click(uploadButton);
    await waitFor(() => expect(uploadButton).toBeDisabled());

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    MockXMLHttpRequest.instances[0].triggerAbort();

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
  });

  it('sets Authorization header with Bearer token from localStorage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) =>
        key === 'castmill_auth_token' ? 'test-token-123' : null
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });

    render(() => (
      <UploadComponent baseUrl="http://test.local" organizationId="org-1" />
    ));

    setFilesOnInput([new File(['data'], 'image.png', { type: 'image/png' })]);
    const uploadButton = screen.getByRole('button', {
      name: 'medias.upload.upload',
    });

    fireEvent.click(uploadButton);
    await waitFor(() => expect(uploadButton).toBeDisabled());

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    const xhr = MockXMLHttpRequest.instances[0];
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Authorization',
      'Bearer test-token-123'
    );
  });

  describe('touch and mobile support', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key;
    const store = { i18n: { t } } as any;

    it('localizes the pickers, drop zone and buttons', () => {
      render(() => (
        <UploadComponent
          baseUrl="http://test.local"
          organizationId="org-1"
          store={store}
          onCancel={() => {}}
        />
      ));

      expect(screen.getByText('medias.upload.chooseFiles')).toBeInTheDocument();
      expect(
        screen.getByText('medias.upload.takePhotoOrVideo')
      ).toBeInTheDocument();
      expect(screen.getByText('medias.upload.dropFiles')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'medias.upload.upload' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'common.close' })
      ).toBeInTheDocument();
    });

    it('offers a camera capture input linked to its label', () => {
      render(() => (
        <UploadComponent baseUrl="http://test.local" organizationId="org-1" />
      ));

      const inputs =
        document.querySelectorAll<HTMLInputElement>('input[type="file"]');
      expect(inputs).toHaveLength(2);
      const [picker, camera] = Array.from(inputs);
      expect(picker.multiple).toBe(true);
      expect(picker.getAttribute('capture')).toBeNull();
      expect(camera.getAttribute('capture')).toBe('environment');
      expect(camera.accept).toBe('image/*,video/*');
      expect(picker.id).not.toBe(camera.id);
      expect(
        document.querySelector(`label[for="${camera.id}"]`)
      ).toHaveTextContent('medias.upload.takePhotoOrVideo');
    });

    it('appends camera captures, filters unsupported files and resets the input', () => {
      render(() => (
        <UploadComponent
          baseUrl="http://test.local"
          organizationId="org-1"
          store={store}
        />
      ));

      setFilesOnInput([new File(['a'], 'first.png', { type: 'image/png' })]);

      const camera =
        document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
      Object.defineProperty(camera, 'files', {
        value: [
          new File(['b'], 'photo.jpg', { type: '' }),
          new File(['c'], 'clip.heic', { type: 'image/heic' }),
        ],
        configurable: true,
      });
      fireEvent.change(camera);

      expect(screen.getByText('first.png')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
      expect(screen.queryByText('clip.heic')).not.toBeInTheDocument();
      expect(toastMock.warning).toHaveBeenCalledWith(
        'medias.upload.unsupportedSkipped:{"count":1}'
      );
      expect(camera.value).toBe('');
    });

    it('shows the upload percentage next to the progress bar', async () => {
      render(() => (
        <UploadComponent baseUrl="http://test.local" organizationId="org-1" />
      ));

      setFilesOnInput([new File(['data'], 'image.png', { type: 'image/png' })]);
      expect(
        screen.getByText('0%', { selector: '.progress-value' })
      ).toBeTruthy();

      fireEvent.click(
        screen.getByRole('button', { name: 'medias.upload.upload' })
      );
      const xhr = MockXMLHttpRequest.instances[0];
      xhr.upload.onprogress?.({
        lengthComputable: true,
        loaded: 42,
        total: 100,
      } as ProgressEvent);

      await waitFor(() =>
        expect(
          screen.getByText('42%', { selector: '.progress-value' })
        ).toBeInTheDocument()
      );
      expect(
        screen.getByRole('progressbar', { name: 'image.png' })
      ).toHaveValue(42);
    });

    it('localizes drop errors and resolves dropped files by extension', () => {
      render(() => (
        <UploadComponent
          baseUrl="http://test.local"
          organizationId="org-1"
          store={store}
        />
      ));

      const { onDrop } = vi.mocked(dropTargetForExternal).mock.calls[0][0];
      const item = (file: File | null, kind = 'file') => ({
        kind,
        getAsFile: () => file,
      });

      onDrop!({
        source: { items: [item(null, 'string')] },
      } as any);
      expect(toastMock.error).toHaveBeenCalledWith(
        'medias.upload.noSupportedFiles'
      );

      onDrop!({
        source: {
          items: [
            item(new File(['v'], 'movie.MOV', { type: '' })),
            item(new File(['x'], 'notes.txt', { type: 'text/plain' })),
          ],
        },
      } as any);
      expect(screen.getByText('movie.MOV')).toBeInTheDocument();
      expect(toastMock.warning).toHaveBeenCalledWith(
        'medias.upload.unsupportedSkipped:{"count":1}'
      );
    });
  });

  describe('resolveSupportedFile', () => {
    it('keeps supported files untouched', () => {
      const file = new File(['a'], 'a.png', { type: 'image/png' });
      expect(resolveSupportedFile(file)).toBe(file);
    });

    it('infers the MIME type from the extension when it is missing', () => {
      const resolved = resolveSupportedFile(
        new File(['a'], 'IMG_0001.JPG', {
          type: 'application/octet-stream',
          lastModified: 7,
        })
      );
      expect(resolved?.type).toBe('image/jpeg');
      expect(resolved?.name).toBe('IMG_0001.JPG');
      expect(resolved?.lastModified).toBe(7);
    });

    it('rejects unknown or explicitly unsupported types', () => {
      expect(
        resolveSupportedFile(new File(['a'], 'a.heic', { type: 'image/heic' }))
      ).toBeUndefined();
      expect(
        resolveSupportedFile(new File(['a'], 'archive', { type: '' }))
      ).toBeUndefined();
    });

    it('partitions files into supported and skipped', () => {
      const { supported, skipped } = partitionSupportedFiles([
        new File(['a'], 'a.mp4', { type: 'video/mp4' }),
        new File(['b'], 'b.doc', { type: '' }),
      ]);
      expect(supported.map((f) => f.name)).toEqual(['a.mp4']);
      expect(skipped).toBe(1);
    });
  });

  describe('responsive styles', () => {
    const scss = readFileSync(resolve(__dirname, 'upload.scss'), 'utf8');

    it('shows the camera and hides the drop zone on touch screens', () => {
      const touch = scss.slice(
        scss.indexOf('@media (hover: none), (pointer: coarse)')
      );
      expect(touch).toMatch(/\.camera-label \{\s*display: inline-flex;/);
      expect(touch).toMatch(/\.drop-zone \{\s*display: none;/);
      expect(touch).toMatch(/\.file-label \{\s*min-height: 2\.75em;/);
      expect(touch).toMatch(/min-width: 2\.75em;\s*min-height: 2\.75em;/);
      expect(scss).toMatch(/\.camera-label \{\s*display: none;/);
    });

    it('hides the size column on phones', () => {
      const phone = scss.slice(scss.indexOf('@media (max-width: 36em)'));
      expect(phone).toMatch(
        /th:nth-child\(2\),\s*td:nth-child\(2\) \{\s*display: none;/
      );
    });
  });
});
