/**
 * Tests for DevicesService
 * Testing the multiple channel assignment functionality
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DevicesService } from './devices.service';

// Mock fetch globally
global.fetch = vi.fn();

describe('DevicesService - Multiple Channel Assignment', () => {
  const baseUrl = 'http://test.com';
  const organizationId = 'org-123';
  const deviceId = 'device-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addChannelToDevice', () => {
    it('should successfully add a channel to a device', async () => {
      const channelId = 1;
      const mockResponse = new Response(null, { status: 200 });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await DevicesService.addChannelToDevice(baseUrl, deviceId, channelId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/devices/${deviceId}/channels`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channel_id: channelId }),
        })
      );
    });

    it('should throw an error when adding a channel fails', async () => {
      const channelId = 1;
      const mockResponse = new Response(
        JSON.stringify({ errors: { detail: 'Channel already assigned' } }),
        { status: 400 }
      );

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        DevicesService.addChannelToDevice(baseUrl, deviceId, channelId)
      ).rejects.toThrow('Channel already assigned');
    });

    it('should handle network errors', async () => {
      const channelId = 1;
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        DevicesService.addChannelToDevice(baseUrl, deviceId, channelId)
      ).rejects.toThrow('Network error');
    });
  });

  describe('removeChannelFromDevice', () => {
    it('should successfully remove a channel from a device', async () => {
      const channelId = 1;
      const mockResponse = new Response(null, { status: 200 });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await DevicesService.removeChannelFromDevice(baseUrl, deviceId, channelId);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/devices/${deviceId}/channels/${channelId}`,
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should throw an error when removing a channel fails', async () => {
      const channelId = 1;
      const mockResponse = new Response(
        JSON.stringify({ errors: { detail: 'Cannot remove last channel' } }),
        { status: 400 }
      );

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        DevicesService.removeChannelFromDevice(baseUrl, deviceId, channelId)
      ).rejects.toThrow('Cannot remove last channel');
    });

    it('should handle network errors', async () => {
      const channelId = 1;
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        DevicesService.removeChannelFromDevice(baseUrl, deviceId, channelId)
      ).rejects.toThrow('Network error');
    });
  });

  describe('fetchChannelByDeviceId', () => {
    it('should fetch channels for a device', async () => {
      const mockChannels = {
        data: [
          {
            id: 1,
            name: 'Channel 1',
            timezone: 'America/New_York',
            organization_id: organizationId,
            default_playlist_id: 1,
            entries: [],
          },
          {
            id: 2,
            name: 'Channel 2',
            timezone: 'Europe/London',
            organization_id: organizationId,
            default_playlist_id: 2,
            entries: [],
          },
        ],
      };

      const mockResponse = new Response(JSON.stringify(mockChannels), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await DevicesService.fetchChannelByDeviceId(
        baseUrl,
        deviceId
      );

      expect(result).toEqual(mockChannels);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/devices/${deviceId}/channels`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('should throw an error when fetching channels fails', async () => {
      const mockResponse = new Response(null, { status: 500, statusText: 'Server Error' });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        DevicesService.fetchChannelByDeviceId(baseUrl, deviceId)
      ).rejects.toThrow('Failed to fetch channel');
    });
  });

  describe('Multiple Channel Operations', () => {
    it('should handle adding multiple channels sequentially', async () => {
      const channelIds = [1, 2, 3];
      const mockResponse = new Response(null, { status: 200 });

      (global.fetch as any).mockResolvedValue(mockResponse);

      for (const channelId of channelIds) {
        await DevicesService.addChannelToDevice(baseUrl, deviceId, channelId);
      }

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle removing channels from a device with multiple channels', async () => {
      // First, mock fetching multiple channels
      const mockChannels = {
        data: [
          { id: 1, name: 'Channel 1', timezone: 'America/New_York', organization_id: organizationId, default_playlist_id: 1, entries: [] },
          { id: 2, name: 'Channel 2', timezone: 'Europe/London', organization_id: organizationId, default_playlist_id: 2, entries: [] },
          { id: 3, name: 'Channel 3', timezone: 'Asia/Tokyo', organization_id: organizationId, default_playlist_id: 3, entries: [] },
        ],
      };

      const fetchResponse = new Response(JSON.stringify(mockChannels), { status: 200 });
      const removeResponse = new Response(null, { status: 200 });

      (global.fetch as any)
        .mockResolvedValueOnce(fetchResponse)
        .mockResolvedValueOnce(removeResponse);

      const channels = await DevicesService.fetchChannelByDeviceId(baseUrl, deviceId);
      expect(channels.data).toHaveLength(3);

      // Remove one channel
      await DevicesService.removeChannelFromDevice(baseUrl, deviceId, 2);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${baseUrl}/dashboard/devices/${deviceId}/channels/2`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors with no error details', async () => {
      const channelId = 1;
      const mockResponse = new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        DevicesService.addChannelToDevice(baseUrl, deviceId, channelId)
      ).rejects.toThrow('Internal Server Error');
    });

    it('should handle malformed JSON error responses', async () => {
      const channelId = 1;
      const mockResponse = new Response('Not JSON', {
        status: 400,
        statusText: 'Bad Request',
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        DevicesService.addChannelToDevice(baseUrl, deviceId, channelId)
      ).rejects.toThrow('Bad Request');
    });
  });
});
