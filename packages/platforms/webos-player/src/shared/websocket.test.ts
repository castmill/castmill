import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebosWebSocket } from './websocket';

describe('WebosWebSocket', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not pass an undefined subprotocol to the native WebSocket constructor', () => {
    const nativeSocket = { readyState: 0 };
    const NativeWebSocket = vi.fn(function () {
      return nativeSocket;
    });
    vi.stubGlobal('WebSocket', NativeWebSocket);

    const socket = new WebosWebSocket('ws://castmill.test/socket/websocket');
    expect(NativeWebSocket).toHaveBeenCalledWith(
      'ws://castmill.test/socket/websocket'
    );
    expect(NativeWebSocket.mock.calls[0]).toHaveLength(1);
    expect(socket).toBe(nativeSocket);
  });
});
