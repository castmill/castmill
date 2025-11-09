import { Component, createSignal, Show } from 'solid-js';
import { RCWindow } from '../rc-window';
import { useI18n } from '../../i18n';

/**
 * Example component showing how to use the RCWindow component
 *
 * Usage:
 * ```tsx
 * import { RCWindowExample } from './components/rc-window-example';
 *
 * <RCWindowExample />
 * ```
 */
export const RCWindowExample: Component = () => {
  const { t } = useI18n();
  const [showRCWindow, setShowRCWindow] = createSignal(false);
  const [deviceId, setDeviceId] = createSignal('device-123');
  const [deviceName, setDeviceName] = createSignal('Conference Room Display');
  const [wsUrl, setWsUrl] = createSignal('wss://example.com/rc');

  const handleOpenRC = () => {
    setShowRCWindow(true);
  };

  const handleCloseRC = () => {
    setShowRCWindow(false);
  };

  return (
    <div style={{ padding: '2em' }}>
      <h1>RC Window Example</h1>

      <div style={{ 'margin-bottom': '1em' }}>
        <label>
          Device ID:
          <input
            type="text"
            value={deviceId()}
            onInput={(e) => setDeviceId(e.currentTarget.value)}
            style={{ 'margin-left': '0.5em', padding: '0.5em' }}
          />
        </label>
      </div>

      <div style={{ 'margin-bottom': '1em' }}>
        <label>
          Device Name:
          <input
            type="text"
            value={deviceName()}
            onInput={(e) => setDeviceName(e.currentTarget.value)}
            style={{ 'margin-left': '0.5em', padding: '0.5em' }}
          />
        </label>
      </div>

      <div style={{ 'margin-bottom': '1em' }}>
        <label>
          WebSocket URL:
          <input
            type="text"
            value={wsUrl()}
            onInput={(e) => setWsUrl(e.currentTarget.value)}
            style={{ 'margin-left': '0.5em', padding: '0.5em', width: '20em' }}
          />
        </label>
      </div>

      <button
        onClick={handleOpenRC}
        style={{
          padding: '0.75em 1.5em',
          'background-color': '#007bff',
          color: 'white',
          border: 'none',
          'border-radius': '0.25em',
          cursor: 'pointer',
          'font-size': '1em',
        }}
      >
        {t('rc.title')}
      </button>

      <Show when={showRCWindow()}>
        <RCWindow
          deviceId={deviceId()}
          deviceName={deviceName()}
          wsUrl={wsUrl()}
          onClose={handleCloseRC}
        />
      </Show>

      <div
        style={{
          'margin-top': '2em',
          'padding-top': '2em',
          'border-top': '1px solid #ccc',
        }}
      >
        <h2>Integration Example</h2>
        <pre
          style={{
            'background-color': '#f5f5f5',
            padding: '1em',
            'border-radius': '0.25em',
            overflow: 'auto',
          }}
        >
          {`import { Component, createSignal, Show } from 'solid-js';
import { RCWindow } from './components/rc-window';

const MyComponent: Component = () => {
  const [showRC, setShowRC] = createSignal(false);

  return (
    <>
      <button onClick={() => setShowRC(true)}>
        Open Remote Control
      </button>

      <Show when={showRC()}>
        <RCWindow
          deviceId="device-123"
          deviceName="My Device"
          wsUrl="wss://your-server.com/rc"
          onClose={() => setShowRC(false)}
        />
      </Show>
    </>
  );
};`}
        </pre>
      </div>

      <div style={{ 'margin-top': '2em' }}>
        <h2>WebSocket Protocol</h2>
        <p>The RC window expects the following message format:</p>

        <h3>Client → Server (Input Events)</h3>
        <pre
          style={{
            'background-color': '#f5f5f5',
            padding: '1em',
            'border-radius': '0.25em',
            overflow: 'auto',
          }}
        >
          {`// Connection handshake
{
  "type": "connect",
  "deviceId": "device-123"
}

// Keyboard events
{
  "type": "keydown" | "keyup",
  "data": {
    "key": "a",
    "code": "KeyA",
    "keyCode": 65,
    "shiftKey": false,
    "ctrlKey": false,
    "altKey": false,
    "metaKey": false
  }
}

// Mouse events (x and y are percentages 0-100)
{
  "type": "mousedown" | "mouseup" | "click",
  "data": {
    "x": 50.5,
    "y": 25.3,
    "button": 0  // 0=left, 1=middle, 2=right
  }
}

{
  "type": "mousemove",
  "data": {
    "x": 50.5,
    "y": 25.3
  }
}`}
        </pre>

        <h3>Server → Client (Screen Updates)</h3>
        <pre
          style={{
            'background-color': '#f5f5f5',
            padding: '1em',
            'border-radius': '0.25em',
            overflow: 'auto',
          }}
        >
          {`// Screen frame (base64 encoded image)
{
  "type": "frame",
  "data": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}

// Error messages
{
  "type": "error",
  "message": "Device not available"
}`}
        </pre>
      </div>
    </div>
  );
};
