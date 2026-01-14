import {
  Component,
  createSignal,
  createEffect,
  onCleanup,
  Show,
} from 'solid-js';
import { useParams, useSearchParams } from '@solidjs/router';
import { Channel, Socket } from 'phoenix';
import { store } from '../../store';
import { useI18n } from '../../i18n';
import { wsEndpoint } from '../../env';
import './remote-control-window.scss';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface FramePayload {
  data: string; // base64 encoded frame data
  codec?: string; // 'h264', 'mjpeg', etc.
  frame_type?: string; // 'idr' (keyframe) or 'p'
  timestamp?: number;
  size?: number;
}

interface StatusPayload {
  status: 'connected' | 'disconnected';
}

const RemoteControlWindow: Component = () => {
  const { t } = useI18n();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const [connectionState, setConnectionState] =
    createSignal<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [channel, setChannel] = createSignal<Channel | null>(null);
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement | null>(
    null
  );
  const [ctx, setCtx] = createSignal<CanvasRenderingContext2D | null>(null);

  const deviceId = params.id;
  const sessionId = searchParams.session;

  // Helper function to calculate canvas coordinates
  const getCanvasCoordinates = (e: MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    
    // Debug logging
    console.log('Canvas coordinates debug:', {
      clientX: e.clientX,
      clientY: e.clientY,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectWidth: rect.width,
      rectHeight: rect.height,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      cssAspectRatio: rect.width / rect.height,
      canvasAspectRatio: canvas.width / canvas.height,
    });
    
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Throttle function for mouse move events
  const throttle = <T extends (...args: any[]) => void>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  };

  // Initialize canvas context
  createEffect(() => {
    const canvas = canvasRef();
    if (canvas) {
      const context = canvas.getContext('2d');
      setCtx(context);
    }
  });

  // Setup WebSocket connection to RC socket
  createEffect(() => {
    if (!sessionId || !deviceId) {
      setConnectionState('error');
      setErrorMessage(t('remoteControl.window.missingParams'));
      return;
    }

    let rcSocket: Socket | null = null;
    let rcChannel: Channel | null = null;

    // Fetch user token for RC socket authentication
    const connectToRcSocket = async () => {
      try {
        const baseUrl = store.env?.baseUrl || 'http://localhost:4000';
        const response = await fetch(`${baseUrl}/sessions/`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to get session token');
        }

        const { token } = await response.json();

        if (!token) {
          throw new Error('No token in session response');
        }

        // Create a separate socket connection to the RC socket endpoint (/ws)
        // This is different from the main dashboard socket (/user_socket)
        rcSocket = new Socket(`${wsEndpoint}/ws`, {
          params: () => ({ token }),
        });
        
        rcSocket.connect();

        // Join RC session channel
        rcChannel = rcSocket.channel(`rc_window:${sessionId}`, {
          device_id: deviceId,
        });

        rcChannel
          .join()
          .receive('ok', (resp: any) => {
            console.log('Joined RC channel', resp);
            setConnectionState('connected');
          })
          .receive('error', (resp: any) => {
            console.error('Failed to join RC channel', resp);
            setConnectionState('error');
            setErrorMessage(
              t('remoteControl.window.connectionError', {
                error: resp.reason || 'Unknown error',
              })
            );
          })
          .receive('timeout', () => {
            console.error('RC channel join timeout');
            setConnectionState('error');
            setErrorMessage(t('remoteControl.window.connectionTimeout'));
          });

        // Listen for video frames (media_frame event from backend)
        rcChannel.on('media_frame', (payload: FramePayload) => {
          console.log('Received media_frame:', {
            codec: payload.codec,
            frame_type: payload.frame_type,
            size: payload.size,
            dataLength: payload.data?.length,
          });

          const context = ctx();
          if (context && payload.data) {
            // Validate base64 data format
            if (!/^[A-Za-z0-9+/=]+$/.test(payload.data)) {
              console.error('Invalid frame data format');
              return;
            }

            // Check size (10MB limit)
            const estimatedSize = (payload.data.length * 3) / 4;
            if (estimatedSize > 10 * 1024 * 1024) {
              console.error('Frame data too large');
              return;
            }

            // Handle different codecs
            const codec = payload.codec?.toLowerCase() || 'mjpeg';
            
            if (codec === 'mjpeg' || codec === 'jpeg') {
              // MJPEG frames can be displayed directly as images
              const img = new Image();
              img.onload = () => {
                const canvas = canvasRef();
                if (canvas) {
                  // Resize canvas to match image dimensions
                  if (canvas.width !== img.width || canvas.height !== img.height) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                  }
                  context.drawImage(img, 0, 0);
                }
              };
              img.onerror = () => {
                console.error('Failed to load frame image');
              };
              img.src = `data:image/jpeg;base64,${payload.data}`;
            } else if (codec === 'h264' || codec === 'avc') {
              // H.264 frames need decoding via WebCodecs API
              // For now, log that we received the frame but can't display it
              // TODO: Implement H.264 decoding using WebCodecs VideoDecoder
              console.log('Received H.264 frame - WebCodecs decoder needed');
              
              // Show a placeholder message on canvas
              const canvas = canvasRef();
              if (canvas && canvas.width > 0 && canvas.height > 0) {
                context.fillStyle = '#1a1a2e';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = '#ffffff';
                context.font = '16px sans-serif';
                context.textAlign = 'center';
                context.fillText(
                  `Receiving H.264 stream (${payload.size} bytes)`,
                  canvas.width / 2,
                  canvas.height / 2
                );
              }
            } else {
              console.warn(`Unknown codec: ${codec}`);
            }
          }
        });

        // Also listen for legacy 'frame' event for backward compatibility
        rcChannel.on('frame', (payload: FramePayload) => {
          console.log('Received legacy frame event');
          const context = ctx();
          if (context && payload.data) {
            const img = new Image();
            img.onload = () => {
              const canvas = canvasRef();
              if (canvas) {
                if (canvas.width !== img.width || canvas.height !== img.height) {
                  canvas.width = img.width;
                  canvas.height = img.height;
                }
                context.drawImage(img, 0, 0);
              }
            };
            img.src = `data:image/jpeg;base64,${payload.data}`;
          }
        });

        // Listen for media metadata (resolution, fps, etc.)
        rcChannel.on('media_metadata', (payload: { width: number; height: number; fps?: number; codec?: string }) => {
          console.log('Received media_metadata:', payload);
          const canvas = canvasRef();
          if (canvas && payload.width && payload.height) {
            canvas.width = payload.width;
            canvas.height = payload.height;
            // Fill with dark background initially
            const context = ctx();
            if (context) {
              context.fillStyle = '#1a1a2e';
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.fillStyle = '#ffffff';
              context.font = '16px sans-serif';
              context.textAlign = 'center';
              context.fillText(
                `Waiting for video stream (${payload.width}x${payload.height})...`,
                canvas.width / 2,
                canvas.height / 2
              );
            }
          }
        });

        // Listen for media stream ready notification
        rcChannel.on('media_stream_ready', (payload: { device_id: string }) => {
          console.log('Media stream ready:', payload);
        });

        // Listen for connection status updates
        rcChannel.on('status', (payload: StatusPayload) => {
          console.log('RC status update:', payload);
          if (payload.status === 'disconnected') {
            setConnectionState('disconnected');
            setErrorMessage(t('remoteControl.window.deviceDisconnected'));
          }
        });

        setChannel(rcChannel);

      } catch (error) {
        console.error('Failed to connect to RC socket:', error);
        setConnectionState('error');
        setErrorMessage(
          t('remoteControl.window.connectionError', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );
      }
    };

    connectToRcSocket();

    // Cleanup when effect re-runs
    onCleanup(() => {
      if (rcChannel) {
        rcChannel.leave();
      }
      if (rcSocket) {
        rcSocket.disconnect();
      }
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    const ch = channel();
    if (ch) {
      ch.leave();
    }
  });

  // Handle mouse input
  const handleMouseDown = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const { x, y } = getCanvasCoordinates(e, canvas);

      ch.push('input', {
        type: 'mousedown',
        x,
        y,
        button: e.button,
      });
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const { x, y } = getCanvasCoordinates(e, canvas);

      ch.push('input', {
        type: 'mouseup',
        x,
        y,
        button: e.button,
      });
    }
  };

  const handleMouseMove = throttle((e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const { x, y } = getCanvasCoordinates(e, canvas);

      ch.push('input', {
        type: 'mousemove',
        x,
        y,
      });
    }
  }, 16); // ~60fps

  const handleClick = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const { x, y } = getCanvasCoordinates(e, canvas);

      ch.push('input', {
        type: 'click',
        x,
        y,
        button: e.button,
      });
    }
  };

  // Attach keyboard listeners to window
  createEffect(() => {
    if (connectionState() === 'connected') {
      const handleKeyDown = (e: KeyboardEvent) => {
        const ch = channel();
        if (ch && connectionState() === 'connected') {
          e.preventDefault();
          ch.push('input', {
            type: 'keydown',
            key: e.key,
            code: e.code,
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            meta: e.metaKey,
          });
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        const ch = channel();
        if (ch && connectionState() === 'connected') {
          e.preventDefault();
          ch.push('input', {
            type: 'keyup',
            key: e.key,
            code: e.code,
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            meta: e.metaKey,
          });
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      onCleanup(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      });
    }
  });

  const getConnectionStatusClass = () => {
    const state = connectionState();
    switch (state) {
      case 'connecting':
        return 'status-connecting';
      case 'connected':
        return 'status-connected';
      case 'disconnected':
        return 'status-disconnected';
      case 'error':
        return 'status-error';
      default:
        return '';
    }
  };

  const getConnectionStatusText = () => {
    const state = connectionState();
    switch (state) {
      case 'connecting':
        return t('remoteControl.window.connecting');
      case 'connected':
        return t('remoteControl.window.connected');
      case 'disconnected':
        return t('remoteControl.window.disconnected');
      case 'error':
        return t('remoteControl.window.error');
      default:
        return '';
    }
  };

  return (
    <div class="remote-control-window">
      <div class="rc-header">
        <div class={`rc-status ${getConnectionStatusClass()}`}>
          <span class="status-indicator"></span>
          <span class="status-text">{getConnectionStatusText()}</span>
        </div>
        <div class="rc-device-info">
          <span class="device-label">{t('remoteControl.window.device')}:</span>
          <span class="device-id">{deviceId}</span>
        </div>
      </div>

      <div class="rc-content">
        <Show
          when={connectionState() === 'connected'}
          fallback={
            <div class="rc-message">
              <Show when={connectionState() === 'connecting'}>
                <div class="loading-spinner"></div>
                <p>{t('remoteControl.window.connectingMessage')}</p>
              </Show>
              <Show
                when={
                  connectionState() === 'error' ||
                  connectionState() === 'disconnected'
                }
              >
                <div class="error-icon">⚠️</div>
                <p class="error-message">{errorMessage()}</p>
                <p class="error-hint">{t('remoteControl.window.errorHint')}</p>
              </Show>
            </div>
          }
        >
          <div class="rc-canvas-container">
            <canvas
              ref={setCanvasRef}
              class="rc-canvas"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              tabIndex={0}
              role="img"
              aria-label={t('remoteControl.window.canvasLabel')}
            />
          </div>
        </Show>
      </div>
    </div>
  );
};

export default RemoteControlWindow;
