import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import RemoteControlWindow from './remote-control-window';
import { I18nProvider } from '../../i18n';
import { setStore } from '../../store/store';

// Mock useParams and useSearchParams
vi.mock('@solidjs/router', () => ({
  useParams: () => ({ id: 'device-456', orgId: 'org-789' }),
  useSearchParams: () => [{ session: 'test-session-123' }],
}));

// Mock socket and channel
const mockChannel = {
  join: vi.fn().mockReturnThis(),
  receive: vi.fn().mockReturnThis(),
  push: vi.fn(),
  on: vi.fn(),
  leave: vi.fn(),
};

const mockSocket = {
  channel: vi.fn(() => mockChannel),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

describe('RemoteControlWindow', () => {
  beforeEach(() => {
    // Setup store with mock socket
    setStore('socket', mockSocket as any);
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default channel behavior
    mockChannel.join.mockReturnThis();
    mockChannel.receive.mockImplementation((event: string, callback: Function) => {
      if (event === 'ok') {
        // Simulate successful join
        setTimeout(() => callback({ status: 'connected' }), 0);
      }
      return mockChannel;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = () => {
    return render(() => (
      <I18nProvider>
        <RemoteControlWindow />
      </I18nProvider>
    ));
  };

  describe('Basic Rendering', () => {
    it('renders the remote control window', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        // Check for device-id specifically
        expect(screen.getByText((content, element) => {
          return element?.classList.contains('device-id') && content === 'device-456';
        })).toBeInTheDocument();
      });
    });

    it('displays device ID in header', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText('device-456')).toBeInTheDocument();
      });
    });

    it('shows connecting status initially', async () => {
      renderWithProviders();
      
      // Should show connecting status - use a more specific selector
      expect(screen.getByText((content, element) => {
        return element?.classList.contains('status-text') && /connecting/i.test(content);
      })).toBeInTheDocument();
    });
  });

  describe('WebSocket Connection', () => {
    it('joins the RC channel with correct parameters', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(mockSocket.channel).toHaveBeenCalledWith(
          'rc:test-session-123',
          { device_id: 'device-456' }
        );
        expect(mockChannel.join).toHaveBeenCalled();
      });
    });

    it('displays connected status after successful join', async () => {
      mockChannel.receive.mockImplementation((event: string, callback: Function) => {
        if (event === 'ok') {
          setTimeout(() => callback({ status: 'connected' }), 0);
        }
        return mockChannel;
      });

      renderWithProviders();
      
      await waitFor(() => {
        // Use a specific selector for status text
        expect(screen.getByText((content, element) => {
          return element?.classList.contains('status-text') && /connected/i.test(content);
        })).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('leaves channel on cleanup', async () => {
      const { unmount } = renderWithProviders();
      
      await waitFor(() => {
        expect(mockChannel.join).toHaveBeenCalled();
      });

      unmount();
      
      expect(mockChannel.leave).toHaveBeenCalled();
    });
  });

  describe('Video Frame Display', () => {
    it('renders canvas element when connected', async () => {
      mockChannel.receive.mockImplementation((event: string, callback: Function) => {
        if (event === 'ok') {
          setTimeout(() => callback({ status: 'connected' }), 0);
        }
        return mockChannel;
      });

      renderWithProviders();
      
      await waitFor(() => {
        const canvas = document.querySelector('canvas.rc-canvas');
        expect(canvas).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('sets up frame listener on channel', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith('frame', expect.any(Function));
      });
    });

    it('sets up status listener on channel', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith('status', expect.any(Function));
      });
    });
  });

  describe('Input Handling', () => {
    beforeEach(() => {
      mockChannel.receive.mockImplementation((event: string, callback: Function) => {
        if (event === 'ok') {
          setTimeout(() => callback({ status: 'connected' }), 0);
        }
        return mockChannel;
      });
    });

    it('sends keyboard input when keys are pressed', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.classList.contains('status-text') && /connected/i.test(content);
        })).toBeInTheDocument();
      }, { timeout: 1000 });

      // Simulate key press
      fireEvent.keyDown(window, {
        key: 'Enter',
        code: 'Enter',
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
      });

      await waitFor(() => {
        expect(mockChannel.push).toHaveBeenCalledWith('input', {
          type: 'keydown',
          key: 'Enter',
          code: 'Enter',
          shift: false,
          ctrl: false,
          alt: false,
          meta: false,
        });
      });
    });

    it('sends mouse click input when canvas is clicked', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        const canvas = document.querySelector('canvas.rc-canvas');
        expect(canvas).toBeInTheDocument();
      }, { timeout: 1000 });

      const canvas = document.querySelector('canvas.rc-canvas') as HTMLCanvasElement;
      
      // Mock canvas dimensions
      Object.defineProperty(canvas, 'width', { value: 1920, writable: true });
      Object.defineProperty(canvas, 'height', { value: 1080, writable: true });
      
      // Mock getBoundingClientRect
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1080,
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.click(canvas, { clientX: 100, clientY: 200, button: 0 });

      await waitFor(() => {
        expect(mockChannel.push).toHaveBeenCalledWith('input', {
          type: 'click',
          x: 100,
          y: 200,
          button: 0,
        });
      });
    });

    it('sends mouse move input when mouse moves over canvas', async () => {
      renderWithProviders();
      
      await waitFor(() => {
        const canvas = document.querySelector('canvas.rc-canvas');
        expect(canvas).toBeInTheDocument();
      }, { timeout: 1000 });

      const canvas = document.querySelector('canvas.rc-canvas') as HTMLCanvasElement;
      
      // Mock canvas dimensions
      Object.defineProperty(canvas, 'width', { value: 1920, writable: true });
      Object.defineProperty(canvas, 'height', { value: 1080, writable: true });
      
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1080,
        width: 1920,
        height: 1080,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      fireEvent.mouseMove(canvas, { clientX: 50, clientY: 75 });

      await waitFor(() => {
        expect(mockChannel.push).toHaveBeenCalledWith('input', {
          type: 'mousemove',
          x: 50,
          y: 75,
        });
      });
    });
  });
});
