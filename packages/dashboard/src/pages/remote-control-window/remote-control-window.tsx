import {
  Component,
  createSignal,
  createEffect,
  onCleanup,
  Show,
} from 'solid-js';
import { useParams, useSearchParams } from '@solidjs/router';
import { store } from '../../store';
import { useI18n } from '../../i18n';
import './remote-control-window.scss';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

const RemoteControlWindow: Component = () => {
  const { t } = useI18n();
  const params = useParams();
  const [searchParams] = useSearchParams();
  
  const [connectionState, setConnectionState] = createSignal<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [channel, setChannel] = createSignal<any>(null);
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = createSignal<CanvasRenderingContext2D | null>(null);

  const deviceId = params.id;
  const sessionId = searchParams.session;

  // Initialize canvas context
  createEffect(() => {
    const canvas = canvasRef();
    if (canvas) {
      const context = canvas.getContext('2d');
      setCtx(context);
    }
  });

  // Setup WebSocket connection
  createEffect(() => {
    const existingSocket = store.socket;
    
    if (!existingSocket || !sessionId || !deviceId) {
      setConnectionState('error');
      setErrorMessage(t('remoteControl.window.missingParams'));
      return;
    }

    // Join RC session channel
    const rcChannel = existingSocket.channel(
      `rc:${sessionId}`,
      { device_id: deviceId }
    );

    rcChannel
      .join()
      .receive('ok', (resp: any) => {
        console.log('Joined RC channel', resp);
        setConnectionState('connected');
      })
      .receive('error', (resp: any) => {
        console.error('Failed to join RC channel', resp);
        setConnectionState('error');
        setErrorMessage(t('remoteControl.window.connectionError', { error: resp.reason || 'Unknown error' }));
      })
      .receive('timeout', () => {
        console.error('RC channel join timeout');
        setConnectionState('error');
        setErrorMessage(t('remoteControl.window.connectionTimeout'));
      });

    // Listen for video frames
    rcChannel.on('frame', (payload: any) => {
      const context = ctx();
      if (context && payload.data) {
        // payload.data is expected to be a base64 encoded image
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
      }
    });

    // Listen for connection status updates
    rcChannel.on('status', (payload: any) => {
      console.log('RC status update:', payload);
      if (payload.status === 'disconnected') {
        setConnectionState('disconnected');
        setErrorMessage(t('remoteControl.window.deviceDisconnected'));
      }
    });

    setChannel(rcChannel);
  });

  // Cleanup on unmount
  onCleanup(() => {
    const ch = channel();
    if (ch) {
      ch.leave();
    }
  });

  // Handle keyboard input
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

  // Handle mouse input
  const handleMouseDown = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      
      ch.push('input', {
        type: 'mousedown',
        x: Math.round(x),
        y: Math.round(y),
        button: e.button,
      });
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      
      ch.push('input', {
        type: 'mouseup',
        x: Math.round(x),
        y: Math.round(y),
        button: e.button,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      
      ch.push('input', {
        type: 'mousemove',
        x: Math.round(x),
        y: Math.round(y),
      });
    }
  };

  const handleClick = (e: MouseEvent) => {
    const ch = channel();
    const canvas = canvasRef();
    if (ch && canvas && connectionState() === 'connected') {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      
      ch.push('input', {
        type: 'click',
        x: Math.round(x),
        y: Math.round(y),
        button: e.button,
      });
    }
  };

  // Attach keyboard listeners to window
  createEffect(() => {
    if (connectionState() === 'connected') {
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
              <Show when={connectionState() === 'error' || connectionState() === 'disconnected'}>
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
            />
          </div>
        </Show>
      </div>
    </div>
  );
};

export default RemoteControlWindow;
