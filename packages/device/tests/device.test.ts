import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { Device, Status } from '../src/classes/device';
import { Cache, ResourceManager } from '@castmill/cache';
import { Socket } from 'phoenix';

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

vi.mock('phoenix', () => ({
  Socket: vi.fn(),
}));

// Helper to create a chainable mock channel.join() return value
function createMockPush() {
  const callbacks: Record<string, Function> = {};
  const push: any = {
    receive: (event: string, cb: Function) => {
      callbacks[event] = cb;
      return push;
    },
    // Allow tests to trigger callbacks
    _trigger: (event: string, payload?: any) => {
      callbacks[event]?.(payload);
    },
    _callbacks: callbacks,
  };
  return push;
}

function createMockPhoenixChannel(joinPush = createMockPush()) {
  return {
    join: vi.fn().mockReturnValue(joinPush),
    on: vi.fn(),
    push: vi.fn(),
    state: 'closed' as string,
    _joinPush: joinPush,
  };
}

function createMockSocket(
  mockChannel: ReturnType<typeof createMockPhoenixChannel>
) {
  return {
    connect: vi.fn(),
    channel: vi.fn().mockReturnValue(mockChannel),
  };
}

/**
 * Install fresh phoenix mocks for tests that call login() directly.
 * Configures the mocked Socket constructor to return the new mock socket.
 * Returns { mockPhoenixChannel, mockSocket } for test assertions.
 */
function installPhoenixMocks() {
  const ch = createMockPhoenixChannel();
  const sock = createMockSocket(ch);
  vi.mocked(Socket).mockImplementation(() => sock as any);
  return { mockPhoenixChannel: ch, mockSocket: sock };
}

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

describe('Device - Brightness listeners', () => {
  let device: Device;
  let mockIntegration: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      getMachineGUID: vi.fn(),
    };

    device = new Device(mockIntegration, {} as any, {
      cache: { maxItems: 100 },
    });
  });

  it('should respond with null brightness when getBrightness throws', async () => {
    mockIntegration.getBrightness = vi
      .fn()
      .mockRejectedValue(new Error('unsupported'));
    const mockChannel = { on: vi.fn(), push: vi.fn(), join: vi.fn() };

    device['initListeners'](mockChannel as any);

    const getHandler = mockChannel.on.mock.calls.find(
      (call: any[]) => call[0] === 'get'
    )?.[1];

    await getHandler({ resource: 'brightness', opts: { ref: 'ref-1' } });

    expect(mockChannel.push).toHaveBeenCalledWith('res:get', {
      brightness: null,
      ref: 'ref-1',
    });
  });

  it('should respond with null brightness when getBrightness returns undefined', async () => {
    mockIntegration.getBrightness = vi.fn().mockResolvedValue(undefined);
    const mockChannel = { on: vi.fn(), push: vi.fn(), join: vi.fn() };

    device['initListeners'](mockChannel as any);

    const getHandler = mockChannel.on.mock.calls.find(
      (call: any[]) => call[0] === 'get'
    )?.[1];

    await getHandler({ resource: 'brightness', opts: { ref: 'ref-1b' } });

    expect(mockChannel.push).toHaveBeenCalledWith('res:get', {
      brightness: null,
      ref: 'ref-1b',
    });
  });

  it('should respond with error when setBrightness is not implemented', async () => {
    const mockChannel = { on: vi.fn(), push: vi.fn(), join: vi.fn() };

    device['initListeners'](mockChannel as any);

    const setHandler = mockChannel.on.mock.calls.find(
      (call: any[]) => call[0] === 'set'
    )?.[1];

    await setHandler({
      resource: 'brightness',
      opts: { brightness: 25, ref: 'ref-2' },
    });

    expect(mockChannel.push).toHaveBeenCalledWith('res:set', {
      result: 'error',
      error: 'Brightness control is not supported on this device',
      ref: 'ref-2',
    });
  });

  it('should respond with error when setBrightness throws', async () => {
    mockIntegration.setBrightness = vi
      .fn()
      .mockRejectedValue(new Error('device rejected change'));
    const mockChannel = { on: vi.fn(), push: vi.fn(), join: vi.fn() };

    device['initListeners'](mockChannel as any);

    const setHandler = mockChannel.on.mock.calls.find(
      (call: any[]) => call[0] === 'set'
    )?.[1];

    await setHandler({
      resource: 'brightness',
      opts: { brightness: 33, ref: 'ref-3' },
    });

    expect(mockChannel.push).toHaveBeenCalledWith('res:set', {
      result: 'error',
      error: 'device rejected change',
      ref: 'ref-3',
    });
  });

  it('should respond with ok when brightness is set successfully', async () => {
    mockIntegration.setBrightness = vi.fn().mockResolvedValue(undefined);
    const mockChannel = { on: vi.fn(), push: vi.fn(), join: vi.fn() };

    device['initListeners'](mockChannel as any);

    const setHandler = mockChannel.on.mock.calls.find(
      (call: any[]) => call[0] === 'set'
    )?.[1];

    await setHandler({
      resource: 'brightness',
      opts: { brightness: 75, ref: 'ref-4' },
    });

    expect(mockIntegration.setBrightness).toHaveBeenCalledWith(75);
    expect(mockChannel.push).toHaveBeenCalledWith('res:set', {
      result: 'ok',
      ref: 'ref-4',
    });
  });
});

describe('Device - Pincode Polling', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockIntegration = {
      getCredentials: vi.fn(),
      getSetting: vi.fn(),
      getMachineGUID: vi.fn().mockResolvedValue('test-hardware-id'),
      removeCredentials: vi.fn(),
      storeCredentials: vi.fn(),
      getLocation: vi.fn().mockResolvedValue({ latitude: 0, longitude: 0 }),
      getTimezone: vi.fn().mockResolvedValue('UTC'),
    };

    mockStorageIntegration = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    device = new Device(mockIntegration, mockStorageIntegration, {
      cache: { maxItems: 100 },
    });
    device['baseUrl'] = 'http://localhost:4000';

    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should keep retrying pincode request when network is unavailable', async () => {
    // First 3 calls fail with network error, 4th succeeds
    fetchSpy
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        status: 201,
        json: async () => ({ data: { pincode: 'ABC123' } }),
      });

    // Start the pincode request (it will await the first fetch which rejects)
    const pincodePromise = device['requestPincode']('test-hardware-id');

    // Advance through the backoff delays for each retry
    // Retry 1: 1s delay (1000 * 2^0)
    await vi.advanceTimersByTimeAsync(1000);
    // Retry 2: 2s delay (1000 * 2^1)
    await vi.advanceTimersByTimeAsync(2000);
    // Retry 3: 4s delay (1000 * 2^2)
    await vi.advanceTimersByTimeAsync(4000);

    const pincode = await pincodePromise;

    expect(pincode).toBe('ABC123');
    expect(fetchSpy).toHaveBeenCalledTimes(4);

    // Verify all calls were to the registrations endpoint
    for (const call of fetchSpy.mock.calls) {
      expect(call[0]).toBe('http://localhost:4000/registrations');
    }
  });

  it('should stop retrying when device is closing', async () => {
    // All calls fail
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    const pincodePromise = device['requestPincode']('test-hardware-id');

    // Attach a catch handler immediately to prevent unhandled rejection
    const resultPromise = pincodePromise.catch((e) => e);

    // Let the first retry happen
    await vi.advanceTimersByTimeAsync(1000);

    // Signal closing
    device['closing'] = true;

    // Advance past the next backoff so the loop checks `closing`
    await vi.advanceTimersByTimeAsync(2000);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Pincode request cancelled: device is closing');
  });

  it('should use exponential backoff between retries', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    // Fail 3 times then succeed
    fetchSpy
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        status: 201,
        json: async () => ({ data: { pincode: 'XYZ789' } }),
      });

    const pincodePromise = device['requestPincode']('test-hardware-id');

    // Advance through each backoff delay
    await vi.advanceTimersByTimeAsync(1000); // 1st retry: 1s
    await vi.advanceTimersByTimeAsync(2000); // 2nd retry: 2s
    await vi.advanceTimersByTimeAsync(4000); // 3rd retry: 4s

    await pincodePromise;

    // Find the setTimeout calls used for backoff delays
    const backoffCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call[1] === 'number' && call[1] >= 1000
    );

    // Verify exponential backoff: 1s, 2s, 4s
    expect(backoffCalls.length).toBeGreaterThanOrEqual(3);
    expect(backoffCalls[0][1]).toBe(1000);
    expect(backoffCalls[1][1]).toBe(2000);
    expect(backoffCalls[2][1]).toBe(4000);
  });
});

describe('Device - loginOrRegister (non-blocking login)', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      getSetting: vi.fn(),
      getMachineGUID: vi.fn().mockResolvedValue('test-hardware-id'),
      removeCredentials: vi.fn().mockResolvedValue(undefined),
      storeCredentials: vi.fn(),
      getLocation: vi.fn().mockResolvedValue({ latitude: 0, longitude: 0 }),
      getTimezone: vi.fn().mockResolvedValue('UTC'),
    };

    mockStorageIntegration = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    device = new Device(mockIntegration, mockStorageIntegration, {
      cache: { maxItems: 100 },
    });
    device['baseUrl'] = 'http://localhost:4000';
  });

  it('should return Status.Ready immediately without waiting for login to complete', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });
    mockIntegration.getCredentials.mockResolvedValue(validCredentials);

    // Mock login to return a promise that never resolves (simulating slow network)
    vi.spyOn(device as any, 'login').mockReturnValue(new Promise(() => {}));

    const result = await device.loginOrRegister();

    // loginOrRegister should still return immediately with Ready
    expect(result.status).toBe(Status.Ready);
    expect(result.pincode).toBeUndefined();
  });

  it('should start login in the background when credentials exist', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });
    mockIntegration.getCredentials.mockResolvedValue(validCredentials);

    const loginSpy = vi
      .spyOn(device as any, 'login')
      .mockReturnValue(new Promise(() => {}));

    const result = await device.loginOrRegister();

    expect(result.status).toBe(Status.Ready);

    // login was called (in the background)
    expect(loginSpy).toHaveBeenCalledWith(
      { device: { id: 'device1', token: 'token123', name: 'Device 1' } },
      'test-hardware-id'
    );
  });

  it('should set up listeners and heartbeat after background login succeeds', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });
    mockIntegration.getCredentials.mockResolvedValue(validCredentials);

    const mockChannel = { on: vi.fn(), push: vi.fn() };

    // Mock login to resolve with a mock channel
    vi.spyOn(device as any, 'login').mockResolvedValue(mockChannel);

    const initListenersSpy = vi.spyOn(device as any, 'initListeners');
    const initHeartbeatSpy = vi.spyOn(device as any, 'initHeartbeat');

    await device.loginOrRegister();

    // Wait for the background .then() to execute
    await vi.waitFor(() => {
      expect(initListenersSpy).toHaveBeenCalledWith(mockChannel);
    });

    expect(initHeartbeatSpy).toHaveBeenCalledWith(mockChannel);
  });

  it('should handle invalid_device error by clearing credentials and reloading', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });
    mockIntegration.getCredentials.mockResolvedValue(validCredentials);

    // Mock login to reject with auth error
    vi.spyOn(device as any, 'login').mockRejectedValue('invalid_device');

    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;

    await device.loginOrRegister();

    // Wait for the background .catch() to execute
    await vi.waitFor(() => {
      expect(mockIntegration.removeCredentials).toHaveBeenCalled();
    });

    expect(window.location.reload).toHaveBeenCalled();

    window.location = originalLocation;
  });

  it('should log non-auth errors without reloading the page', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });
    mockIntegration.getCredentials.mockResolvedValue(validCredentials);

    // Mock login to reject with a non-auth error
    vi.spyOn(device as any, 'login').mockRejectedValue('connection_timeout');

    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;

    await device.loginOrRegister();

    // Flush microtasks to let the background .catch handler execute
    await new Promise((r) => queueMicrotask(r));
    await new Promise((r) => queueMicrotask(r));

    // Should NOT reload or remove credentials for non-auth errors
    expect(mockIntegration.removeCredentials).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();

    window.location = originalLocation;
  });
});

describe('Device - Login Reconnection', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;
  let mockPhoenixChannel: ReturnType<typeof createMockPhoenixChannel>;

  beforeEach(() => {
    vi.useFakeTimers();

    const mocks = installPhoenixMocks();
    mockPhoenixChannel = mocks.mockPhoenixChannel;

    mockIntegration = {
      getCredentials: vi.fn(),
      getSetting: vi.fn(),
      getMachineGUID: vi.fn().mockResolvedValue('test-hardware-id'),
      removeCredentials: vi.fn().mockResolvedValue(undefined),
      storeCredentials: vi.fn(),
      getLocation: vi.fn().mockResolvedValue({ latitude: 0, longitude: 0 }),
      getTimezone: vi.fn().mockResolvedValue('UTC'),
    };

    mockStorageIntegration = {};

    device = new Device(mockIntegration, mockStorageIntegration, {
      cache: { maxItems: 100 },
    });
    device['baseUrl'] = 'http://localhost:4000';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should only reject on auth errors (invalid_device)', async () => {
    const credentials = {
      device: { id: 'd1', token: 't1', name: 'D1' },
    };

    const loginPromise = device.login(credentials as any, 'hw1');

    // Trigger auth error
    mockPhoenixChannel._joinPush._trigger('error', 'invalid_device');

    await expect(loginPromise).rejects.toBe('invalid_device');
  });

  it('should only reject on auth errors (unauthorized)', async () => {
    const credentials = {
      device: { id: 'd1', token: 't1', name: 'D1' },
    };

    const loginPromise = device.login(credentials as any, 'hw1');

    // Trigger auth error
    mockPhoenixChannel._joinPush._trigger('error', 'unauthorized');

    await expect(loginPromise).rejects.toBe('unauthorized');
  });

  it('should NOT reject on non-auth errors (keep trying)', async () => {
    const credentials = {
      device: { id: 'd1', token: 't1', name: 'D1' },
    };

    const loginPromise = device.login(credentials as any, 'hw1');
    let resolved = false;
    let rejected = false;

    loginPromise.then(() => (resolved = true)).catch(() => (rejected = true));

    // Trigger non-auth error
    mockPhoenixChannel._joinPush._trigger('error', 'some_connection_error');

    // Wait one tick
    await vi.advanceTimersByTimeAsync(100);

    // Should still be pending — not rejected
    expect(resolved).toBe(false);
    expect(rejected).toBe(false);

    // Now simulate a successful rejoin via the polling mechanism
    mockPhoenixChannel.state = 'joined';
    await vi.advanceTimersByTimeAsync(1000);

    expect(resolved).toBe(true);
    expect(rejected).toBe(false);
  });

  it('should resolve when channel state becomes joined (polling mechanism)', async () => {
    const credentials = {
      device: { id: 'd1', token: 't1', name: 'D1' },
    };

    const loginPromise = device.login(credentials as any, 'hw1');

    // Trigger timeout (does not reject)
    mockPhoenixChannel._joinPush._trigger('timeout');

    // Wait — should not resolve or reject yet
    await vi.advanceTimersByTimeAsync(500);

    // Simulate the channel successfully joining via reconnection
    mockPhoenixChannel.state = 'joined';

    // Advance past the 1s polling interval
    await vi.advanceTimersByTimeAsync(1000);

    const result = await loginPromise;
    expect(result).toBe(mockPhoenixChannel);
  });

  it('should clean up polling interval after resolving', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const credentials = {
      device: { id: 'd1', token: 't1', name: 'D1' },
    };

    const loginPromise = device.login(credentials as any, 'hw1');

    // Simulate successful join
    mockPhoenixChannel._joinPush._trigger('ok');

    await loginPromise;

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should not resolve twice when both ok and polling detect joined', async () => {
    const credentials = {
      device: { id: 'd1', token: 't1', name: 'D1' },
    };

    let resolveCount = 0;
    const loginPromise = device.login(credentials as any, 'hw1');
    loginPromise.then(() => resolveCount++);

    // Trigger ok callback
    mockPhoenixChannel._joinPush._trigger('ok');

    // Also set state to joined
    mockPhoenixChannel.state = 'joined';

    // Advance past polling interval
    await vi.advanceTimersByTimeAsync(2000);

    // Should only resolve once
    expect(resolveCount).toBe(1);
  });
});

describe('Device - Progress Events', () => {
  let device: Device;
  let mockIntegration: any;
  let mockStorageIntegration: any;

  beforeEach(() => {
    mockIntegration = {
      getCredentials: vi.fn(),
      getSetting: vi.fn(),
      getMachineGUID: vi.fn().mockResolvedValue('test-hardware-id'),
      removeCredentials: vi.fn(),
      storeCredentials: vi.fn(),
      getLocation: vi.fn().mockResolvedValue({ latitude: 0, longitude: 0 }),
      getTimezone: vi.fn().mockResolvedValue('UTC'),
    };

    mockStorageIntegration = {};

    device = new Device(mockIntegration, mockStorageIntegration, {
      cache: { maxItems: 100 },
    });
    device['baseUrl'] = 'http://localhost:4000';
  });

  it('should emit progress events with correct structure', () => {
    const progressEvents: any[] = [];
    device.on('progress', (event) => progressEvents.push(event));

    device['emitProgress'](2, 5, 'Loading');

    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]).toEqual({
      step: 2,
      totalSteps: 5,
      percent: 40,
      label: 'Loading',
    });
  });

  it('should emit progress during loginOrRegister with credentials', async () => {
    const validCredentials = JSON.stringify({
      device: { id: 'device1', token: 'token123', name: 'Device 1' },
    });
    mockIntegration.getCredentials.mockResolvedValue(validCredentials);

    const progressEvents: any[] = [];
    device.on('progress', (event) => progressEvents.push(event));

    await device.loginOrRegister();

    // Should have emitted 'Identifying device' progress (step 1 of 5 when credentials exist)
    const identifyEvent = progressEvents.find(
      (e) => e.label === 'Identifying device'
    );
    expect(identifyEvent).toBeDefined();
    expect(identifyEvent.totalSteps).toBe(5);
    expect(identifyEvent.step).toBe(1);
  });

  it('should emit progress during loginOrRegister without credentials (registration path)', async () => {
    mockIntegration.getCredentials.mockResolvedValue(null);

    const progressEvents: any[] = [];
    device.on('progress', (event) => progressEvents.push(event));

    // Mock fetch for registration
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({ data: { pincode: 'ABCDEF' } }),
      })
    );

    // Install phoenix mocks for registration
    installPhoenixMocks();

    const result = await device.loginOrRegister();

    expect(result.status).toBe(Status.Registering);

    // Should have emitted 'Identifying device' progress (step 1 of 3 when no credentials)
    const identifyEvent = progressEvents.find(
      (e) => e.label === 'Identifying device'
    );
    expect(identifyEvent).toBeDefined();
    expect(identifyEvent.totalSteps).toBe(3);
    expect(identifyEvent.step).toBe(1);

    vi.restoreAllMocks();
  });
});
