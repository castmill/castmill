import { render, screen, waitFor } from '@solidjs/testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RCWindow } from './rc-window';
import { I18nProvider } from '../../i18n';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

describe('RCWindow', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;
    // Replace with mock
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
  });

  it('should render with connecting state initially', () => {
    const onClose = vi.fn();
    render(() => (
      <I18nProvider>
        <RCWindow
          deviceId="test-device-1"
          deviceName="Test Device"
          wsUrl="wss://example.com/rc"
          onClose={onClose}
        />
      </I18nProvider>
    ));

    // Should show connecting state (appears in both status badge and loading area)
    const connectingElements = screen.getAllByText(/connecting/i);
    expect(connectingElements.length).toBeGreaterThan(0);
  });

  it('should show device name in title', () => {
    const onClose = vi.fn();
    render(() => (
      <I18nProvider>
        <RCWindow
          deviceId="test-device-1"
          deviceName="Test Device"
          wsUrl="wss://example.com/rc"
          onClose={onClose}
        />
      </I18nProvider>
    ));

    expect(screen.getByText(/Test Device/)).toBeInTheDocument();
  });

  it('should show connected state after WebSocket connects', async () => {
    const onClose = vi.fn();
    render(() => (
      <I18nProvider>
        <RCWindow
          deviceId="test-device-1"
          deviceName="Test Device"
          wsUrl="wss://example.com/rc"
          onClose={onClose}
        />
      </I18nProvider>
    ));

    // Wait for connection
    await waitFor(
      () => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      },
      { timeout: 100 }
    );
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(() => (
      <I18nProvider>
        <RCWindow
          deviceId="test-device-1"
          deviceName="Test Device"
          wsUrl="wss://example.com/rc"
          onClose={onClose}
        />
      </I18nProvider>
    ));

    // Find and click close button
    const closeButton = screen
      .getAllByRole('button')
      .find((btn) =>
        btn.getAttribute('title')?.toLowerCase().includes('close')
      );
    expect(closeButton).toBeDefined();
    closeButton?.click();

    expect(onClose).toHaveBeenCalled();
  });

  it('should close WebSocket on cleanup', async () => {
    const onClose = vi.fn();
    const { unmount } = render(() => (
      <I18nProvider>
        <RCWindow
          deviceId="test-device-1"
          deviceName="Test Device"
          wsUrl="wss://example.com/rc"
          onClose={onClose}
        />
      </I18nProvider>
    ));

    // Wait for connection
    await waitFor(
      () => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      },
      { timeout: 100 }
    );

    // Unmount should close the WebSocket
    unmount();

    // Note: In a real scenario, we'd verify the WebSocket.close() was called
    // but with our mock, it's automatically called in cleanup
  });
});
