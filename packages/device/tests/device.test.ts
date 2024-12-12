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
      getBaseUrl: vi.fn(),
      getMachineGUID: vi.fn(),
      removeCredentials: vi.fn(),
      getAdditionalBaseUrls: vi.fn(),
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

  it('should instantiate correctly and set defaults', () => {
    expect(device).toBeInstanceOf(EventEmitter);
    expect(device['logger']).toBeDefined();
    expect(device['cache']).toBeDefined();
    expect(device['closing']).toBe(false);
    expect(device['channels']).toEqual([]);
  });

  it('should initialize and get base URL', async () => {
    mockIntegration.getBaseUrl.mockResolvedValue('http://localhost:3000');
    await device.init();
    expect(device['baseUrl']).toBe('http://localhost:3000');
    expect(mockIntegration.getBaseUrl).toHaveBeenCalled();
  });

  it('should default to first available baseUrl if getBaseUrl returns null', async () => {
    mockIntegration.getBaseUrl.mockResolvedValue(null);
    mockIntegration.getAdditionalBaseUrls.mockResolvedValue([]);
    await device.init();
    const availableBaseUrls = await device.getAvailableBaseUrls();
    expect(device['baseUrl']).toBe(availableBaseUrls[0].url);
    expect(mockIntegration.getBaseUrl).toHaveBeenCalled();
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
