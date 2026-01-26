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

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

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
  const [hasReceivedFrames, setHasReceivedFrames] = createSignal(false);
  const [reconnectAttempt, setReconnectAttempt] = createSignal(0);

  // Max reconnection attempts before giving up
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 2000;

  const deviceId = params.id;
  const sessionId = searchParams.session;

  // Drag state tracking
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 10; // Minimum pixels to consider it a drag vs a click

  // Helper function to calculate canvas coordinates
  // This handles CSS scaling of the canvas element properly
  const getCanvasCoordinates = (e: MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    
    // Calculate CSS vs internal canvas scaling
    const cssScaleX = canvas.width / rect.width;
    const cssScaleY = canvas.height / rect.height;
    
    // Convert mouse position relative to canvas CSS box to internal canvas coordinates
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Apply CSS scaling to get canvas pixel coordinates
    const x = mouseX * cssScaleX;
    const y = mouseY * cssScaleY;
    
    // Debug logging
    console.log('Canvas coordinates debug:', {
      mouse: { clientX: e.clientX, clientY: e.clientY },
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      canvas: { width: canvas.width, height: canvas.height },
      cssScale: { x: cssScaleX, y: cssScaleY },
      relativePos: { mouseX, mouseY },
      canvasCoords: { x: Math.round(x), y: Math.round(y) },
    });
    
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
      setErrorMessage(t('devices.remoteControl.window.missingParams'));
      return;
    }

    let rcSocket: Socket | null = null;
    let rcChannel: Channel | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCleaningUp = false;

    // Function to attempt reconnection
    const attemptReconnect = () => {
      if (isCleaningUp) return;
      
      const attempt = reconnectAttempt();
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached');
        setConnectionState('error');
        setErrorMessage(t('devices.remoteControl.window.reconnectFailed'));
        return;
      }
      
      setReconnectAttempt(attempt + 1);
      setConnectionState('reconnecting');
      console.log(`Reconnection attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS}`);
      
      reconnectTimeout = setTimeout(() => {
        connectToRcSocket();
      }, RECONNECT_DELAY_MS);
    };

    // Fetch user token for RC socket authentication
    const connectToRcSocket = async () => {
      if (isCleaningUp) return;
      
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

        // Clean up any existing socket
        if (rcSocket) {
          rcSocket.disconnect();
        }

        // Create a separate socket connection to the RC socket endpoint (/ws)
        // This is different from the main dashboard socket (/user_socket)
        rcSocket = new Socket(`${wsEndpoint}/ws`, {
          params: () => ({ token }),
          // Disable automatic reconnection - we'll handle reconnection manually
          reconnectAfterMs: () => null,
        });
        
        // Handle socket-level connection errors
        rcSocket.onError(() => {
          console.error('Socket connection error');
          if (!isCleaningUp && connectionState() === 'connected') {
            // Lost connection during active session - try to reconnect
            attemptReconnect();
          }
        });
        
        rcSocket.onClose(() => {
          console.log('Socket closed');
          if (!isCleaningUp && connectionState() === 'connected') {
            // Lost connection during active session - try to reconnect
            attemptReconnect();
          }
        });
        
        rcSocket.connect();

        // Join RC session channel - disable automatic rejoin
        rcChannel = rcSocket.channel(`rc_window:${sessionId}`, {
          device_id: deviceId,
        });
        // Disable automatic rejoin on error (session might be closed)
        rcChannel.rejoinUntilConnected = () => {};

        rcChannel
          .join()
          .receive('ok', (resp: any) => {
            console.log('Joined RC channel', resp);
            setConnectionState('connected');
            // Reset reconnect attempts on successful connection
            setReconnectAttempt(0);
          })
          .receive('error', (resp: any) => {
            console.error('Failed to join RC channel', resp);
            // If we were reconnecting and join fails, the session might be closed
            if (connectionState() === 'reconnecting') {
              setConnectionState('error');
              setErrorMessage(t('devices.remoteControl.window.sessionClosed'));
            } else {
              setConnectionState('error');
              setErrorMessage(
                t('devices.remoteControl.window.connectionError', {
                  error: resp.reason || 'Unknown error',
                })
              );
            }
            // Disconnect socket when join fails
            if (rcSocket) {
              rcSocket.disconnect();
            }
          })
          .receive('timeout', () => {
            console.error('RC channel join timeout');
            // If reconnecting, try again
            if (connectionState() === 'reconnecting') {
              attemptReconnect();
            } else {
              setConnectionState('error');
              setErrorMessage(t('devices.remoteControl.window.connectionTimeout'));
              if (rcSocket) {
                rcSocket.disconnect();
              }
            }
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

            // Mark that we've received frames
            if (!hasReceivedFrames()) {
              setHasReceivedFrames(true);
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
            setErrorMessage(t('devices.remoteControl.window.deviceDisconnected'));
          }
        });

        setChannel(rcChannel);

      } catch (error) {
        console.error('Failed to connect to RC socket:', error);
        setConnectionState('error');
        setErrorMessage(
          t('devices.remoteControl.window.connectionError', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );
      }
    };

    connectToRcSocket();

    // Cleanup when effect re-runs
    onCleanup(() => {
      isCleaningUp = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
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

  // Handle mouse input with drag support
  const handleMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef();
    if (canvas && connectionState() === 'connected' && e.button === 0) {
      const { x, y } = getCanvasCoordinates(e, canvas);
      setDragStart({ x, y });
      setIsDragging(false);
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    const start = dragStart();
    
    if (ch && canvas && connectionState() === 'connected' && e.button === 0 && start) {
      const { x, y } = getCanvasCoordinates(e, canvas);
      
      // Calculate distance moved
      const distance = Math.sqrt(
        Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2)
      );
      
      if (distance >= DRAG_THRESHOLD) {
        // It's a drag/swipe gesture
        ch.push('input', {
          type: 'drag',
          startX: start.x,
          startY: start.y,
          endX: x,
          endY: y,
        });
        console.log('Drag gesture:', { start, end: { x, y }, distance });
      } else {
        // It's a click/tap
        ch.push('input', {
          type: 'click',
          x: start.x,
          y: start.y,
          button: e.button,
        });
      }
    }
    
    setDragStart(null);
    setIsDragging(false);
  };

  const handleMouseMove = throttle((e: MouseEvent) => {
    const canvas = canvasRef();
    const start = dragStart();
    
    if (canvas && start) {
      const { x, y } = getCanvasCoordinates(e, canvas);
      const distance = Math.sqrt(
        Math.pow(x - start.x, 2) + Math.pow(y - start.y, 2)
      );
      
      if (distance >= DRAG_THRESHOLD) {
        setIsDragging(true);
      }
    }
  }, 16); // ~60fps

  // Prevent default click when dragging
  const handleClick = (e: MouseEvent) => {
    // Click is now handled in mouseUp based on drag distance
    // This prevents duplicate events
    e.preventDefault();
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
      case 'reconnecting':
        return 'status-reconnecting';
      default:
        return '';
    }
  };

  const getConnectionStatusText = () => {
    const state = connectionState();
    switch (state) {
      case 'connecting':
        return t('devices.remoteControl.window.connecting');
      case 'connected':
        return t('devices.remoteControl.window.connected');
      case 'disconnected':
        return t('devices.remoteControl.window.disconnected');
      case 'error':
        return t('devices.remoteControl.window.error');
      case 'reconnecting':
        return t('devices.remoteControl.window.reconnecting', { attempt: reconnectAttempt(), max: MAX_RECONNECT_ATTEMPTS });
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
          <span class="device-label">{t('devices.remoteControl.window.device')}:</span>
          <span class="device-id">{deviceId}</span>
        </div>
      </div>

      <div class="rc-content">
        <Show
          when={connectionState() === 'connected' || connectionState() === 'reconnecting'}
          fallback={
            <div class="rc-message">
              <Show when={connectionState() === 'connecting'}>
                <div class="loading-spinner"></div>
                <p>{t('devices.remoteControl.window.connectingMessage')}</p>
              </Show>
              <Show
                when={
                  connectionState() === 'error' ||
                  connectionState() === 'disconnected'
                }
              >
                <div class="error-icon">⚠️</div>
                <p class="error-message">{errorMessage()}</p>
                <p class="error-hint">{t('devices.remoteControl.window.errorHint')}</p>
              </Show>
            </div>
          }
        >
          <div class="rc-canvas-container">
            <Show when={!hasReceivedFrames() || connectionState() === 'reconnecting'}>
              <div class="rc-waiting-overlay">
                <div class="loading-spinner"></div>
                <Show when={connectionState() === 'reconnecting'}>
                  <p>{t('devices.remoteControl.window.reconnectingMessage', { attempt: reconnectAttempt(), max: MAX_RECONNECT_ATTEMPTS })}</p>
                </Show>
                <Show when={connectionState() !== 'reconnecting'}>
                  <p>{t('devices.remoteControl.window.waitingForFrames')}</p>
                </Show>
              </div>
            </Show>
            <canvas
              ref={setCanvasRef}
              class="rc-canvas"
              classList={{ 'rc-canvas-hidden': !hasReceivedFrames() }}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              tabIndex={0}
              role="img"
              aria-label={t('devices.remoteControl.window.canvasLabel')}
            />
          </div>
        </Show>
      </div>
    </div>
  );
};

export default RemoteControlWindow;
