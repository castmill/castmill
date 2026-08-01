import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { UploadComponent } from './upload';

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
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
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
    const uploadButton = screen.getByRole('button', { name: 'Upload' });

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

    const uploadButton = screen.getByRole('button', { name: 'Upload' });
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
    const uploadButton = screen.getByRole('button', { name: 'Upload' });

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
    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    fireEvent.click(uploadButton);
    await waitFor(() => expect(uploadButton).toBeDisabled());

    expect(MockXMLHttpRequest.instances).toHaveLength(1);
    const xhr = MockXMLHttpRequest.instances[0];
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Authorization',
      'Bearer test-token-123'
    );
  });
});
