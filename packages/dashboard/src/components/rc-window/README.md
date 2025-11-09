# RC Window Component

A fully-featured Remote Control window component for the Castmill Dashboard, enabling real-time control of digital signage devices through WebSocket connections.

## Features

- **Real-time WebSocket Connection**: Establishes and maintains WebSocket connections for bidirectional communication
- **Input Capture**: Captures and forwards keyboard and mouse events to remote devices
- **Connection Status**: Visual indicators for connection states (connecting, connected, disconnected)
- **Fullscreen Mode**: Support for fullscreen viewing of remote display
- **Error Handling**: Graceful error display and recovery
- **Internationalization**: Full i18n support for 9 languages
- **Responsive Design**: Adapts to different screen sizes
- **Accessibility**: Keyboard navigation and screen reader support

## Installation

The component is already part of the dashboard package. Simply import it:

```tsx
import { RCWindow } from './components/rc-window';
```

## Usage

### Basic Example

```tsx
import { Component, createSignal, Show } from 'solid-js';
import { RCWindow } from './components/rc-window';

const MyComponent: Component = () => {
  const [showRC, setShowRC] = createSignal(false);

  return (
    <>
      <button onClick={() => setShowRC(true)}>Open Remote Control</button>

      <Show when={showRC()}>
        <RCWindow
          deviceId="device-123"
          deviceName="Conference Room Display"
          wsUrl="wss://your-server.com/rc"
          onClose={() => setShowRC(false)}
        />
      </Show>
    </>
  );
};
```

### Props

| Prop         | Type         | Required | Description                                        |
| ------------ | ------------ | -------- | -------------------------------------------------- |
| `deviceId`   | `string`     | Yes      | Unique identifier for the device to control        |
| `deviceName` | `string`     | No       | Human-readable name of the device (shown in title) |
| `wsUrl`      | `string`     | Yes      | WebSocket URL for the remote control connection    |
| `onClose`    | `() => void` | Yes      | Callback function when the window is closed        |

## WebSocket Protocol

### Client → Server Messages

#### Connection Handshake

```json
{
  "type": "connect",
  "deviceId": "device-123"
}
```

#### Keyboard Events

```json
{
  "type": "keydown",
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

{
  "type": "keyup",
  "data": { /* same structure as keydown */ }
}
```

#### Mouse Events

```json
{
  "type": "mousedown",
  "data": {
    "x": 50.5,    // percentage (0-100)
    "y": 25.3,    // percentage (0-100)
    "button": 0   // 0=left, 1=middle, 2=right
  }
}

{
  "type": "mouseup",
  "data": { /* same structure as mousedown */ }
}

{
  "type": "click",
  "data": { /* same structure as mousedown */ }
}

{
  "type": "mousemove",
  "data": {
    "x": 50.5,
    "y": 25.3
  }
}
```

### Server → Client Messages

#### Screen Frame Updates

```json
{
  "type": "frame",
  "data": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}
```

#### Error Messages

```json
{
  "type": "error",
  "message": "Device not available"
}
```

## User Interactions

### Keyboard Controls

- **ESC**: Close the RC window (when not in fullscreen)
- **Any Key**: When display area is focused, keys are captured and sent to remote device
- Focus the display area by clicking on it to enable keyboard control

### Mouse Controls

- **Click**: Click on display area to send click events to remote device
- **Drag**: Hold and drag to send mouse move events
- **Coordinates**: Mouse position is normalized to percentages (0-100) for device-independent positioning

### Window Controls

- **Close Button**: Top-right corner button to close the window
- **Fullscreen Toggle**: Button to enter/exit fullscreen mode
- **Overlay Click**: Click outside the window to close it

## Styling

The component uses SCSS modules with the following main classes:

- `.rc-window-overlay`: Full-screen overlay background
- `.rc-window-container`: Main window container
- `.rc-window-header`: Header with title and controls
- `.rc-window-display`: Display area for remote screen
- `.rc-window-instructions`: Bottom instructions bar

Custom styling can be applied by:

1. Overriding CSS variables:

```css
:root {
  --color-background: #1a1a1a;
  --color-surface: #252525;
  --color-primary: #007bff;
  --color-text-primary: #ffffff;
  --color-text-secondary: #aaa;
}
```

2. Using CSS module classes directly
3. Adding custom wrapper styles

## Internationalization

All user-facing strings are localized. Translation keys:

- `rc.title`: "Remote Control"
- `rc.connecting`: "Connecting..."
- `rc.connected`: "Connected"
- `rc.disconnected`: "Disconnected"
- `rc.notConnected`: "Not connected to device"
- `rc.connectionError`: "Failed to establish connection"
- `rc.enterFullscreen`: "Enter fullscreen"
- `rc.exitFullscreen`: "Exit fullscreen"
- `rc.instructions`: Usage instructions text

## Testing

Run tests with:

```bash
yarn test rc-window
```

The test suite includes:

- Connection state management
- WebSocket mocking
- UI interaction testing
- Cleanup verification

## Architecture

### Component Structure

```
rc-window/
├── rc-window.tsx       # Main component
├── rc-window.scss      # Styles
├── rc-window.test.tsx  # Tests
└── index.ts           # Exports
```

### Key Concepts

1. **WebSocket Management**: Connection is established in a `createEffect` and cleaned up in `onCleanup`
2. **Event Handling**: Separate handlers for keyboard and mouse events
3. **State Management**: SolidJS signals for reactive state
4. **Modal Behavior**: Uses Portal for overlay rendering

## Backend Integration

To implement the backend WebSocket endpoint:

1. Accept WebSocket connections at your specified URL
2. Authenticate the connection (validate device access)
3. Handle incoming messages based on `type` field
4. Send screen frames periodically or on-demand
5. Handle disconnections gracefully

Example backend pseudocode:

```javascript
ws.on('message', (msg) => {
  const data = JSON.parse(msg);

  switch (data.type) {
    case 'connect':
      // Validate device access
      // Start streaming
      break;
    case 'keydown':
    case 'keyup':
      // Forward to device
      break;
    case 'mousedown':
    case 'mouseup':
    case 'mousemove':
    case 'click':
      // Convert percentage coords to absolute
      // Forward to device
      break;
  }
});
```

## Browser Compatibility

- Modern browsers with WebSocket support
- Fullscreen API support (optional feature)
- ES6+ JavaScript support

## Performance Considerations

- Mouse move events are only sent when mouse button is pressed
- Connection status is managed with reactive signals
- Display area uses GPU-accelerated CSS for smooth rendering
- Screen frames should be optimized (JPEG with quality control recommended)

## Security

- Always use WSS (WebSocket Secure) in production
- Implement authentication at the WebSocket endpoint
- Validate device access permissions
- Sanitize all input before forwarding to devices
- Consider rate limiting for input events

## Troubleshooting

### Connection Issues

- Verify WebSocket URL is correct and accessible
- Check CORS settings on the server
- Ensure device is online and accepting connections
- Check browser console for connection errors

### Input Not Working

- Ensure display area has focus (click on it)
- Verify WebSocket is in "open" state
- Check backend is receiving and processing messages

### Performance Issues

- Reduce screen frame update frequency
- Optimize frame encoding (use JPEG, reduce quality/size)
- Check network latency
- Monitor WebSocket message queue

## Future Enhancements

Potential improvements:

- Audio streaming support
- Video codec optimization (WebRTC)
- Touch event support for mobile
- Clipboard synchronization
- File transfer capability
- Multi-monitor support
- Recording/playback functionality
- Bandwidth usage indicator
- Latency meter

## License

Part of the Castmill Dashboard project. See main LICENSE file for details.

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review the example component
3. Open an issue on GitHub
4. Contact the Castmill development team
