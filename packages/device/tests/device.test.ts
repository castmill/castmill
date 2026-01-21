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

describe('Device - Channel Updates', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;

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
  });

  it('should handle channel_updated event and update channel default_playlist_id', async () => {
    // Create a mock Phoenix channel
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    // Set up mock channels on the device
    device['channels'] = [
      {
        attrs: {
          id: '123',
          name: 'Test Channel',
          default_playlist_id: '100',
        },
      } as any,
      {
        attrs: {
          id: '456',
          name: 'Another Channel',
          default_playlist_id: '200',
        },
      } as any,
    ];

    // Call initListeners to set up the handlers
    device['initListeners'](mockChannel as any);

    // Find the 'channel_updated' event handler
    const channelUpdatedHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'channel_updated'
    )?.[1];

    expect(channelUpdatedHandler).toBeDefined();

    // Simulate the channel_updated event
    await channelUpdatedHandler({
      event: 'channel_updated',
      channel_id: 123,
      default_playlist_id: 999,
    });

    // Verify that the channel's default_playlist_id was updated
    expect(device['channels'][0].attrs.default_playlist_id).toBe('999');

    // Verify that the other channel was not affected
    expect(device['channels'][1].attrs.default_playlist_id).toBe('200');
  });

  it('should handle channel_updated event with null default_playlist_id', async () => {
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    device['channels'] = [
      {
        attrs: {
          id: '123',
          name: 'Test Channel',
          default_playlist_id: '100',
        },
      } as any,
    ];

    device['initListeners'](mockChannel as any);

    const channelUpdatedHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'channel_updated'
    )?.[1];

    expect(channelUpdatedHandler).toBeDefined();

    // Simulate the channel_updated event with null default_playlist_id
    await channelUpdatedHandler({
      event: 'channel_updated',
      channel_id: 123,
      default_playlist_id: null,
    });

    // Verify that the channel's default_playlist_id was set to undefined
    expect(device['channels'][0].attrs.default_playlist_id).toBeUndefined();
  });

  it('should not update if channel is not found', async () => {
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    device['channels'] = [
      {
        attrs: {
          id: '123',
          name: 'Test Channel',
          default_playlist_id: '100',
        },
      } as any,
    ];

    device['initListeners'](mockChannel as any);

    const channelUpdatedHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'channel_updated'
    )?.[1];

    expect(channelUpdatedHandler).toBeDefined();

    // Simulate the channel_updated event for a non-existent channel
    await channelUpdatedHandler({
      event: 'channel_updated',
      channel_id: 999,
      default_playlist_id: 888,
    });

    // Verify that the existing channel was not affected
    expect(device['channels'][0].attrs.default_playlist_id).toBe('100');
  });

  it('should handle channel_added event and add new channel to list', async () => {
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    device['channels'] = [
      {
        attrs: {
          id: '123',
          name: 'Existing Channel',
          default_playlist_id: '100',
        },
      } as any,
    ];

    device['initListeners'](mockChannel as any);

    const channelAddedHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'channel_added'
    )?.[1];

    expect(channelAddedHandler).toBeDefined();

    // Simulate the channel_added event
    await channelAddedHandler({
      event: 'channel_added',
      channel: {
        id: 456,
        name: 'New Channel',
        timezone: 'Europe/Amsterdam',
        default_playlist_id: 789,
        entries: [],
      },
    });

    // Verify that the new channel was added
    expect(device['channels'].length).toBe(2);
    expect(device['channels'][1].attrs.id).toBe('456');
    expect(device['channels'][1].attrs.name).toBe('New Channel');
    expect(device['channels'][1].attrs.default_playlist_id).toBe('789');
  });

  it('should handle channel_removed event and remove channel from list', async () => {
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    device['channels'] = [
      {
        attrs: {
          id: '123',
          name: 'Channel 1',
          default_playlist_id: '100',
        },
      } as any,
      {
        attrs: {
          id: '456',
          name: 'Channel 2',
          default_playlist_id: '200',
        },
      } as any,
    ];
    device['channelIndex'] = 1;

    device['initListeners'](mockChannel as any);

    const channelRemovedHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'channel_removed'
    )?.[1];

    expect(channelRemovedHandler).toBeDefined();

    // Simulate the channel_removed event
    await channelRemovedHandler({
      event: 'channel_removed',
      channel_id: 456,
    });

    // Verify that the channel was removed
    expect(device['channels'].length).toBe(1);
    expect(device['channels'][0].attrs.id).toBe('123');

    // Verify that channelIndex was reset since it was pointing to the removed channel
    expect(device['channelIndex']).toBe(0);
  });

  it('should not affect channels when removing non-existent channel', async () => {
    const mockChannel = {
      on: vi.fn(),
      push: vi.fn(),
      join: vi.fn(),
    };

    device['channels'] = [
      {
        attrs: {
          id: '123',
          name: 'Channel 1',
          default_playlist_id: '100',
        },
      } as any,
    ];

    device['initListeners'](mockChannel as any);

    const channelRemovedHandler = mockChannel.on.mock.calls.find(
      (call) => call[0] === 'channel_removed'
    )?.[1];

    expect(channelRemovedHandler).toBeDefined();

    // Simulate the channel_removed event for a non-existent channel
    await channelRemovedHandler({
      event: 'channel_removed',
      channel_id: 999,
    });

    // Verify that the existing channel was not affected
    expect(device['channels'].length).toBe(1);
    expect(device['channels'][0].attrs.id).toBe('123');
  });
});
