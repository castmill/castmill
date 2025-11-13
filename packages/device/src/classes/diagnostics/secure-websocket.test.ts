import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SecureWebSocketConnection,
  validateSecureEndpoint,
  generateAuthParams,
  validateCertificateFingerprint,
  SecureConnectionConfig,
} from './secure-websocket';

// Mock Phoenix Socket
vi.mock('phoenix', () => ({
  Socket: vi.fn().mockImplementation((endpoint, options) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onOpen: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
    endpoint,
    options,
  })),
}));

describe('SecureWebSocketConnection', () => {
  let config: SecureConnectionConfig;

  beforeEach(() => {
    config = {
      deviceId: 'test-device-123',
      deviceToken: 'test-token-456',
      hardwareId: 'hw-789',
      endpoint: 'wss://example.com/socket',
    };
    vi.clearAllMocks();
  });

  describe('Configuration Validation', () => {
    it('should accept secure wss:// endpoint', () => {
      const connection = new SecureWebSocketConnection(config);
      expect(connection).toBeDefined();
    });

    it('should reject insecure ws:// endpoint in production', () => {
      const insecureConfig = {
        ...config,
        endpoint: 'ws://example.com/socket',
      };

      expect(() => new SecureWebSocketConnection(insecureConfig)).toThrow(
        'Insecure WebSocket endpoint'
      );
    });

    it('should set default security options', async () => {
      const connection = new SecureWebSocketConnection(config);
      await connection.connect();

      // Should have default reconnect strategy
      expect(connection).toBeDefined();
    });

    it('should apply custom reconnection strategy', async () => {
      const customConfig = {
        ...config,
        reconnectAfterMs: (tries: number) => tries * 5000,
      };

      const connection = new SecureWebSocketConnection(customConfig);
      await connection.connect();

      expect(connection).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('should connect with authentication parameters', async () => {
      const connection = new SecureWebSocketConnection(config);
      await connection.connect();

      const socket = connection.getSocket();
      expect(socket).toBeDefined();
      expect(socket?.connect).toHaveBeenCalled();
    });

    it('should track connection status', async () => {
      const connection = new SecureWebSocketConnection(config);

      let status = connection.getStatus();
      expect(status.state).toBe('disconnected');

      await connection.connect();

      status = connection.getStatus();
      expect(status.state).toBe('connected');
      expect(status.lastSuccessfulConnect).toBeGreaterThan(0);
    });

    it('should disconnect properly', async () => {
      const connection = new SecureWebSocketConnection(config);
      await connection.connect();

      connection.disconnect();

      const status = connection.getStatus();
      expect(status.state).toBe('disconnected');

      const socket = connection.getSocket();
      expect(socket).toBeUndefined();
    });

    it('should track last connection attempt', async () => {
      const connection = new SecureWebSocketConnection(config);
      const beforeConnect = Date.now();

      await connection.connect();

      const status = connection.getStatus();
      expect(status.lastConnectAttempt).toBeGreaterThanOrEqual(beforeConnect);
    });
  });

  describe('Token Management', () => {
    it('should allow token updates', async () => {
      const connection = new SecureWebSocketConnection(config);
      await connection.connect();

      connection.updateToken('new-token-789');

      // Should reconnect with new token
      const status = connection.getStatus();
      expect(status.state).toBe('connected');
    });

    it('should include token in connection parameters', async () => {
      const connection = new SecureWebSocketConnection(config);
      await connection.connect();

      const socket = connection.getSocket();
      expect(socket?.options.params.token).toBe(config.deviceToken);
    });
  });

  describe('Certificate Pinning', () => {
    it('should detect certificate pinning configuration', () => {
      const pinnedConfig = {
        ...config,
        pinnedCertificates: [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        ],
      };

      const connection = new SecureWebSocketConnection(pinnedConfig);
      expect(connection.hasCertificatePinning()).toBe(true);
    });

    it('should not report pinning when not configured', () => {
      const connection = new SecureWebSocketConnection(config);
      expect(connection.hasCertificatePinning()).toBe(false);
    });

    it('should accept multiple pinned certificates', () => {
      const pinnedConfig = {
        ...config,
        pinnedCertificates: [
          'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
        ],
      };

      const connection = new SecureWebSocketConnection(pinnedConfig);
      expect(connection.hasCertificatePinning()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const { Socket } = await import('phoenix');
      (Socket as any).mockImplementationOnce((endpoint: string, options: any) => {
        const mockSocket = {
          connect: vi.fn(() => {
            throw new Error('Connection failed');
          }),
          disconnect: vi.fn(),
          onOpen: vi.fn(),
          onError: vi.fn(),
          onClose: vi.fn(),
          endpoint,
          options,
        };
        return mockSocket;
      });

      const connection = new SecureWebSocketConnection(config);

      await expect(connection.connect()).rejects.toThrow('Connection failed');

      const status = connection.getStatus();
      expect(status.state).toBe('error');
    });

    it('should track certificate validation errors', async () => {
      const connection = new SecureWebSocketConnection(config);
      await connection.connect();

      const socket = connection.getSocket();
      // Simulate certificate error
      const errorHandler = (socket?.onError as any).mock.calls[0][0];
      errorHandler({ message: 'TLS certificate validation failed' });

      const status = connection.getStatus();
      expect(status.state).toBe('error');
      expect(status.certificateValid).toBe(false);
    });
  });
});

describe('validateSecureEndpoint', () => {
  it('should accept wss:// URLs', () => {
    expect(validateSecureEndpoint('wss://example.com/socket')).toBe(true);
  });

  it('should reject ws:// URLs in production', () => {
    // Mock production environment
    const originalEnv = import.meta.env.DEV;
    import.meta.env.DEV = false;

    expect(validateSecureEndpoint('ws://example.com/socket')).toBe(false);

    import.meta.env.DEV = originalEnv;
  });

  it('should allow ws://localhost in development', () => {
    // Mock development environment
    const originalEnv = import.meta.env.DEV;
    import.meta.env.DEV = true;

    expect(validateSecureEndpoint('ws://localhost:4000/socket')).toBe(true);
    expect(validateSecureEndpoint('ws://127.0.0.1:4000/socket')).toBe(true);

    import.meta.env.DEV = originalEnv;
  });

  it('should reject invalid URLs', () => {
    expect(validateSecureEndpoint('not-a-url')).toBe(false);
  });

  it('should reject non-WebSocket protocols', () => {
    expect(validateSecureEndpoint('https://example.com')).toBe(false);
    expect(validateSecureEndpoint('http://example.com')).toBe(false);
  });
});

describe('generateAuthParams', () => {
  it('should include device ID and token', () => {
    const config: SecureConnectionConfig = {
      deviceId: 'device-123',
      deviceToken: 'token-456',
      endpoint: 'wss://example.com/socket',
    };

    const params = generateAuthParams(config);

    expect(params.device_id).toBe('device-123');
    expect(params.token).toBe('token-456');
  });

  it('should include hardware ID when provided', () => {
    const config: SecureConnectionConfig = {
      deviceId: 'device-123',
      deviceToken: 'token-456',
      hardwareId: 'hw-789',
      endpoint: 'wss://example.com/socket',
    };

    const params = generateAuthParams(config);

    expect(params.hardware_id).toBe('hw-789');
  });

  it('should include timestamp for replay attack prevention', () => {
    const config: SecureConnectionConfig = {
      deviceId: 'device-123',
      deviceToken: 'token-456',
      endpoint: 'wss://example.com/socket',
    };

    const before = Date.now();
    const params = generateAuthParams(config);
    const after = Date.now();

    expect(params.timestamp).toBeGreaterThanOrEqual(before);
    expect(params.timestamp).toBeLessThanOrEqual(after);
  });

  it('should merge custom parameters', () => {
    const config: SecureConnectionConfig = {
      deviceId: 'device-123',
      deviceToken: 'token-456',
      endpoint: 'wss://example.com/socket',
      params: {
        custom_param: 'custom_value',
        another_param: 42,
      },
    };

    const params = generateAuthParams(config);

    expect(params.custom_param).toBe('custom_value');
    expect(params.another_param).toBe(42);
  });
});

describe('validateCertificateFingerprint', () => {
  it('should log warning about browser limitations', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    const result = validateCertificateFingerprint(
      {},
      ['sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=']
    );

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(result).toBe(true); // Always returns true in browser environment

    consoleWarnSpy.mockRestore();
  });

  it('should suggest native implementation', () => {
    const consoleInfoSpy = vi.spyOn(console, 'info');

    validateCertificateFingerprint({}, []);

    expect(consoleInfoSpy).toHaveBeenCalled();

    consoleInfoSpy.mockRestore();
  });
});
