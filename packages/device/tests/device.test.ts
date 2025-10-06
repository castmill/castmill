import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { Device } from '../src/classes/device';
import { Cache, ResourceManager } from '@castmill/cache';

vi.mock('@castmill/cache', () => ({
  Cache: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    clean: vi.fn(),
  })),
  ResourceManager: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    getData: vi.fn().mockResolvedValue({ data: [] }),
    cacheMedia: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('Device', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      getSetting: vi.fn(),
      getMachineGUID: vi.fn(),
      removeCredentials: vi.fn(),
    };

    mockStorageIntegration = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    // mock vite env
    device = new Device(mockIntegration, mockStorageIntegration, {
      cache: { maxItems: 100 },
    });
  });

  it('should instantiate correctly and set defaults', () => {
    expect(device).toBeInstanceOf(EventEmitter);
    expect(device['logger']).toBeDefined();
    expect(device['cache']).toBeDefined();
    expect(device['closing']).toBe(false);
    expect(device['channels']).toEqual([]);
  });

  it('should initialize and get base URL', async () => {
    mockIntegration.getSetting.mockResolvedValue('http://localhost:3000');
    await device.init();
    expect(device['baseUrl']).toBe('http://localhost:3000');
    expect(mockIntegration.getSetting).toHaveBeenCalled();
  });

  it('should default to VITE_DEFAULT_BASE_URL if getBaseUrl returns null', async () => {
    mockIntegration.getSetting.mockResolvedValue(null);
    vi.stubEnv('VITE_DEFAULT_BASE_URL', 'https://default.castmill.io');
    await device.init();
    const defaultBaseUrl = 'https://default.castmill.io';
    expect(device['baseUrl']).toBe(defaultBaseUrl);
  });

  it('should default to first available baseUrl if getBaseUrl returns null and VITE_DEFAULT_BASE_URL is unset', async () => {
    mockIntegration.getSetting.mockResolvedValue(null);
    vi.stubEnv('VITE_DEFAULT_BASE_URL', '');
    vi.stubEnv('VITE_PRODUCTION_BASE_URL', 'https://prod.castmill.io');
    await device.init();
    const availableBaseUrls = await device.getAvailableBaseUrls();
    expect(device['baseUrl']).toBe(availableBaseUrls[0].url);
    expect(mockIntegration.getSetting).toHaveBeenCalled();
  });
});

describe('Device - Credentials', () => {
  let device: Device;
  let mockIntegration: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      removeCredentials: vi.fn(),
      getMachineGUID: vi.fn(),
    };

    device = new Device(mockIntegration, {} as any);
  });

  it('should get valid credentials', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });

    mockIntegration.getCredentials.mockResolvedValue(validCredentials);
    const credentials = await device.getCredentials();
    expect(credentials).toEqual(JSON.parse(validCredentials));
  });

  it('should return undefined for invalid credentials', async () => {
    mockIntegration.getCredentials.mockResolvedValue(null);
    const credentials = await device.getCredentials();
    expect(credentials).toBeUndefined();
  });

  it('should handle invalid credentials', async () => {
    mockIntegration.getCredentials.mockResolvedValue('{invalid_json');
    const credentials = await device.getCredentials();
    expect(credentials).toBeUndefined();
  });
});

describe('Device - Start/Stop', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      getBaseUrl: vi.fn(),
      getMachineGUID: vi.fn(),
      removeCredentials: vi.fn(),
    };

    mockStorageIntegration = {};

    device = new Device(mockIntegration, mockStorageIntegration);
  });

  it('should throw an error if credentials are invalid on start', async () => {
    mockIntegration.getCredentials.mockResolvedValue(null);
    await expect(device.start(document.createElement('div'))).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('should stop the device and set closing flag', async () => {
    device['player'] = { stop: vi.fn() } as any;
    const playerStopSpy = vi.spyOn(device['player'], 'stop');
    await device.stop();
    expect(device['closing']).toBe(true);
    expect(device['player']).toBeUndefined();
    expect(playerStopSpy).toHaveBeenCalled();
  });
});

describe('Device - Commands', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;
  let mockCache: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      getMachineGUID: vi.fn(),
      removeCredentials: vi.fn().mockResolvedValue(undefined),
    };

    mockStorageIntegration = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    device = new Device(mockIntegration, mockStorageIntegration, {
      cache: { maxItems: 100 },
    });

    // Mock the cache
    mockCache = {
      clean: vi.fn().mockResolvedValue(undefined),
    };
    device['cache'] = mockCache;
  });

  it('should handle device_removed command by clearing credentials and cache', async () => {
    // Mock location.reload to prevent actual page reload in tests
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;

    // Create a mock Phoenix channel
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    // Get the command handler by calling initListeners
    device['initListeners'](mockChannel as any);

    // Find the 'command' event handler
    const commandHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'command'
    )?.[1];

    expect(commandHandler).toBeDefined();

    // Simulate the device_removed command
    await commandHandler({ command: 'device_removed' });

    // Verify that credentials were removed
    expect(mockIntegration.removeCredentials).toHaveBeenCalled();

    // Verify that cache was cleaned
    expect(mockCache.clean).toHaveBeenCalled();

    // Verify that page reload was called
    expect(window.location.reload).toHaveBeenCalled();

    // Restore location
    window.location = originalLocation;
  });
});
