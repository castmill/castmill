import {
  Component,
  createSignal,
  onMount,
  onCleanup,
  Show,
  createEffect,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { AiOutlineClose } from 'solid-icons/ai';
import { BsArrowsFullscreen, BsFullscreenExit } from 'solid-icons/bs';
import { useI18n } from '../../i18n';
import './rc-window.scss';

interface RCWindowProps {
  deviceId: string;
  deviceName?: string;
  wsUrl: string;
  onClose: () => void;
}

interface RCMessage {
  type: 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove' | 'click';
  data: any;
}

export const RCWindow: Component<RCWindowProps> = (props) => {
  const { t } = useI18n();
  const [isConnected, setIsConnected] = createSignal(false);
  const [isConnecting, setIsConnecting] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isActive, setIsActive] = createSignal(false);

  let ws: WebSocket | null = null;
  let displayRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Animation for modal appearance
  onMount(() => {
    setTimeout(() => {
      setIsActive(true);
    }, 10);
  });

  // Setup WebSocket connection
  createEffect(() => {
    try {
      ws = new WebSocket(props.wsUrl);

      ws.onopen = () => {
        console.log('RC WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);

        // Send initial handshake
        ws?.send(
          JSON.stringify({
            type: 'connect',
            deviceId: props.deviceId,
          })
        );
      };

      ws.onclose = () => {
        console.log('RC WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onerror = (event) => {
        console.error('RC WebSocket error:', event);
        setError(t('rc.connectionError'));
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError(t('rc.connectionError'));
      setIsConnecting(false);
    }
  });

  // Cleanup WebSocket on unmount
  onCleanup(() => {
    if (ws) {
      ws.close();
      ws = null;
    }
  });

  // Handle messages from server
  const handleServerMessage = (message: any) => {
    switch (message.type) {
      case 'frame':
        // Handle screen frame updates
        if (displayRef && message.data) {
          // Display the frame (base64 image or video stream)
          displayRef.style.backgroundImage = `url(${message.data})`;
        }
        break;
      case 'error':
        setError(message.message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // Send input event to server
  const sendInput = (message: RCMessage) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  // Keyboard event handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only capture events when display is focused
    if (document.activeElement !== displayRef) return;

    e.preventDefault();
    sendInput({
      type: 'keydown',
      data: {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      },
    });
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (document.activeElement !== displayRef) return;

    e.preventDefault();
    sendInput({
      type: 'keyup',
      data: {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      },
    });
  };

  // Mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    if (!displayRef) return;

    const rect = displayRef.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    sendInput({
      type: 'mousedown',
      data: {
        x,
        y,
        button: e.button,
      },
    });
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!displayRef) return;

    const rect = displayRef.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    sendInput({
      type: 'mouseup',
      data: {
        x,
        y,
        button: e.button,
      },
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!displayRef || e.buttons === 0) return;

    const rect = displayRef.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    sendInput({
      type: 'mousemove',
      data: {
        x,
        y,
      },
    });
  };

  const handleClick = (e: MouseEvent) => {
    if (!displayRef) return;

    const rect = displayRef.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    sendInput({
      type: 'click',
      data: {
        x,
        y,
        button: e.button,
      },
    });
  };

  // Attach keyboard listeners when display is in view
  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  });

  // Handle ESC key to close
  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isFullscreen()) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleEscapeKey);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleEscapeKey);
  });

  const toggleFullscreen = () => {
    if (!containerRef) return;

    if (!document.fullscreenElement) {
      containerRef.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Portal mount={document.body}>
      <div
        class={`rc-window-overlay ${isActive() ? 'active' : ''}`}
        onClick={handleOverlayClick}
      >
        <div
          class="rc-window-container"
          ref={containerRef}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="rc-window-header">
            <div class="rc-window-title">
              <h2>
                {t('rc.title')} - {props.deviceName || props.deviceId}
              </h2>
              <Show when={isConnecting()}>
                <span class="rc-window-status rc-window-status-connecting">
                  {t('rc.connecting')}
                </span>
              </Show>
              <Show when={isConnected()}>
                <span class="rc-window-status rc-window-status-connected">
                  {t('rc.connected')}
                </span>
              </Show>
              <Show when={!isConnecting() && !isConnected()}>
                <span class="rc-window-status rc-window-status-disconnected">
                  {t('rc.disconnected')}
                </span>
              </Show>
            </div>
            <div class="rc-window-controls">
              <button
                class="rc-window-control-btn"
                onClick={toggleFullscreen}
                title={
                  isFullscreen()
                    ? t('rc.exitFullscreen')
                    : t('rc.enterFullscreen')
                }
              >
                <Show
                  when={isFullscreen()}
                  fallback={<BsArrowsFullscreen size={20} />}
                >
                  <BsFullscreenExit size={20} />
                </Show>
              </button>
              <button
                class="rc-window-control-btn"
                onClick={props.onClose}
                title={t('common.close')}
              >
                <AiOutlineClose size={20} />
              </button>
            </div>
          </div>

          {/* Error message */}
          <Show when={error()}>
            <div class="rc-window-error">{error()}</div>
          </Show>

          {/* Display area */}
          <div
            class="rc-window-display"
            ref={displayRef}
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
          >
            <Show when={isConnecting()}>
              <div class="rc-window-loading">
                <div class="rc-window-spinner"></div>
                <p>{t('rc.connecting')}</p>
              </div>
            </Show>
            <Show when={!isConnected() && !isConnecting()}>
              <div class="rc-window-disconnected-message">
                <p>{t('rc.notConnected')}</p>
              </div>
            </Show>
          </div>

          {/* Instructions */}
          <div class="rc-window-instructions">
            <p>{t('rc.instructions')}</p>
          </div>
        </div>
      </div>
    </Portal>
  );
};
