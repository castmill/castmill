/**
 * Tests for PlaylistsService
 * Testing the search functionality in getWidgets method
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaylistsService } from './playlists.service';

// Mock fetch globally
global.fetch = vi.fn();

describe('PlaylistsService', () => {
  const baseUrl = 'http://test.com';
  const organizationId = 'org-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updatePlaylist', () => {
    it('should update playlist with aspect ratio settings', async () => {
      const playlistId = '1';
      const playlistUpdate = {
        name: 'Updated Playlist',
        description: 'Test',
        settings: {
          aspect_ratio: {
            width: 16,
            height: 9,
          },
        },
      };

      const mockResponse = new Response(null, { status: 200 });
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await PlaylistsService.updatePlaylist(
        baseUrl,
        organizationId,
        playlistId,
        playlistUpdate
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ update: playlistUpdate }),
        })
      );
    });
  });

  describe('getWidgets', () => {
    it('should fetch widgets without search parameter', async () => {
      const mockWidgets = {
        data: [
          {
            id: 1,
            name: 'Image Widget',
            description: 'Display an image',
            icon: '📦',
          },
          {
            id: 2,
            name: 'Video Widget',
            description: 'Display a video',
            icon: '📦',
          },
        ],
        count: 2,
      };

      const mockResponse = new Response(JSON.stringify(mockWidgets), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await PlaylistsService.getWidgets(baseUrl, organizationId);

      expect(result).toEqual(mockWidgets);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should fetch widgets with search parameter', async () => {
      const searchTerm = 'video';
      const mockWidgets = {
        data: [
          {
            id: 2,
            name: 'Video Widget',
            description: 'Display a video',
            icon: '📦',
          },
        ],
        count: 1,
      };

      const mockResponse = new Response(JSON.stringify(mockWidgets), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await PlaylistsService.getWidgets(
        baseUrl,
        organizationId,
        searchTerm
      );

      expect(result).toEqual(mockWidgets);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets?search=${searchTerm}`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should fetch widgets with empty search string', async () => {
      const mockWidgets = {
        data: [
          {
            id: 1,
            name: 'Image Widget',
            description: 'Display an image',
            icon: '📦',
          },
        ],
        count: 1,
      };

      const mockResponse = new Response(JSON.stringify(mockWidgets), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await PlaylistsService.getWidgets(
        baseUrl,
        organizationId,
        ''
      );

      expect(result).toEqual(mockWidgets);
      // Empty search should not add search parameter to URL
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it.skip('should handle URL encoding for search terms with special characters', async () => {
      const searchTerm = 'widget & layout';
      const mockWidgets = {
        data: [],
        count: 0,
      };

      const mockResponse = new Response(JSON.stringify(mockWidgets), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await PlaylistsService.getWidgets(baseUrl, organizationId, searchTerm);

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets?search=${encodeURIComponent(searchTerm)}`,
        expect.any(Object)
      );
    });

    it('should throw an error when fetching widgets fails', async () => {
      const mockResponse = new Response(
        JSON.stringify({ errors: { detail: 'Failed to fetch widgets' } }),
        { status: 500 }
      );

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(
        PlaylistsService.getWidgets(baseUrl, organizationId)
      ).rejects.toThrow('Failed to fetch widgets');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        PlaylistsService.getWidgets(baseUrl, organizationId)
      ).rejects.toThrow('Network error');
    });

    it('should return empty array when no widgets match search', async () => {
      const searchTerm = 'nonexistent';
      const mockWidgets = {
        data: [],
        count: 0,
      };

      const mockResponse = new Response(JSON.stringify(mockWidgets), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await PlaylistsService.getWidgets(
        baseUrl,
        organizationId,
        searchTerm
      );

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('fetchPlaylists', () => {
    it('should fetch playlists with search parameter', async () => {
      const mockPlaylists = {
        data: [{ id: 1, name: 'Test Playlist' }],
        count: 1,
      };

      const mockResponse = new Response(JSON.stringify(mockPlaylists), {
        status: 200,
      });

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await PlaylistsService.fetchPlaylists(
        baseUrl,
        organizationId,
        {
          page: 1,
          page_size: 10,
          sortOptions: {},
          search: 'test',
        }
      );

      expect(result).toEqual(mockPlaylists);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
        expect.any(Object)
      );
    });
  });
});
