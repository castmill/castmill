import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Socket } from 'phoenix';
import { WebSocketLogger } from './websocket-logger'; // Adjust the import path as needed

// Prepare the mock channel outside to ensure it is the same instance
const mockChannel = {
  join: vi.fn().mockReturnThis(),
  push: vi.fn().mockReturnThis(),
  receive: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  leave: vi.fn().mockReturnThis(),
};

vi.mock('phoenix', () => ({
  Socket: vi.fn().mockImplementation(() => ({
    channel: vi.fn(() => mockChannel),
  })),
}));

describe('WebSocketLogger', () => {
  let logger: WebSocketLogger;
  let mockSocket: Socket;
  let channelMock: any;

  beforeEach(() => {
    mockSocket = new Socket('');
    channelMock = mockSocket.channel('device_telemetry:device1');
    logger = new WebSocketLogger(mockSocket, 'device1');
  });

  it('should send logs over WebSocket', async () => {
    const expectedMessage = {
      message: 'WebSocket test log',
      level: 'info',
      timestamp: expect.any(String),
    };
    await logger.log('info', 'WebSocket test log');

    expect(mockSocket.channel).toHaveBeenCalledWith('device_telemetry:device1');

    // Ensure the channel was created correctly
    expect(channelMock.join).toHaveBeenCalled();

    channelMock.push('eriowoeirhwejr');
    // Check that push was called correctly
    expect(channelMock.push).toHaveBeenCalledWith('log', expectedMessage);
  });
});
