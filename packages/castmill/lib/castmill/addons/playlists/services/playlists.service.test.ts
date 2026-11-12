/**
 * Tests for PlaylistsService
 * Testing the search functionality in getWidgets method
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SortOptions } from '@castmill/ui-common';
import { PlaylistsService, WidgetChoicesError } from './playlists.service';

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
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets?page=1&page_size=100`,
        expect.objectContaining({
          method: 'GET',
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
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets?page=1&page_size=100&search=${searchTerm}`,
        expect.objectContaining({
          method: 'GET',
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
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets?page=1&page_size=100`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle URL encoding for search terms with special characters', async () => {
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
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets?page=1&page_size=100&search=widget+%26+layout`,
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

    it.each([undefined, 'LF & Facebook'])(
      'loads all widget pages with search %s, including beyond 100 widgets',
      async (search) => {
        const widgets = Array.from({ length: 205 }, (_, i) => ({
          id: i + 1,
          name: `Widget ${i + 1}`,
        }));
        for (let start = 0; start < widgets.length; start += 100) {
          vi.mocked(global.fetch).mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                data: widgets.slice(start, start + 100),
                count: 205,
              }),
              { status: 200 }
            )
          );
        }

        const result = await PlaylistsService.getWidgets(
          baseUrl,
          organizationId,
          search
        );

        expect(result).toEqual({ data: widgets, count: 205 });
        expect(global.fetch).toHaveBeenCalledTimes(3);
        for (let page = 1; page <= 3; page++) {
          const query = new URLSearchParams({
            page: String(page),
            page_size: '100',
          });
          if (search) query.set('search', search);
          expect(global.fetch).toHaveBeenNthCalledWith(
            page,
            `${baseUrl}/dashboard/organizations/${organizationId}/widgets?${query}`,
            expect.objectContaining({ method: 'GET' })
          );
        }
      }
    );

    it('loads all widgets when the server returns smaller pages', async () => {
      const widgets = Array.from({ length: 23 }, (_, i) => ({ id: i + 1 }));
      for (let start = 0; start < widgets.length; start += 10) {
        vi.mocked(global.fetch).mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: widgets.slice(start, start + 10),
              count: 23,
            })
          )
        );
      }
      expect(
        await PlaylistsService.getWidgets(baseUrl, organizationId)
      ).toEqual({
        data: widgets,
        count: 23,
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('rejects a failed later page instead of returning a truncated list', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [{ id: 1 }], count: 2 }))
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: { detail: 'Page failed' } }), {
            status: 500,
          })
        );
      await expect(
        PlaylistsService.getWidgets(baseUrl, organizationId)
      ).rejects.toThrow('Page failed');
    });

    it('rejects an empty intermediate page instead of looping forever', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [{ id: 1 }], count: 2 }))
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [], count: 2 }))
        );
      await expect(
        PlaylistsService.getWidgets(baseUrl, organizationId)
      ).rejects.toThrow(
        'Widget pagination returned an empty page before completion'
      );
      expect(global.fetch).toHaveBeenCalledTimes(2);
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
          sortOptions: {} as SortOptions,
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

  describe('listWidgetChoices', () => {
    const request = {
      options: { listing: 'L1' },
      query: 'kitchen',
      cursor: null,
      values: ['p1'],
    };

    it('posts the request and returns the page', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ value: 'p1', label: 'Kitchen' }],
            next: 'abc',
          }),
          { status: 200 }
        )
      );

      const page = await PlaylistsService.listWidgetChoices(
        baseUrl,
        organizationId,
        42,
        'selected images',
        request
      );

      expect(page).toEqual({
        items: [{ value: 'p1', label: 'Kitchen' }],
        next: 'abc',
      });
      const [url, init] = (global.fetch as any).mock.calls[0];
      expect(url).toBe(
        `${baseUrl}/dashboard/organizations/${organizationId}/widgets/42/choices/selected%20images`
      );
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual(request);
    });

    it('defaults malformed pages', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ items: 'nope', next: 3 }), {
          status: 200,
        })
      );

      await expect(
        PlaylistsService.listWidgetChoices(
          baseUrl,
          organizationId,
          1,
          'f',
          request
        )
      ).resolves.toEqual({ items: [], next: null });
    });

    it('throws the server error code', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'provider_error' }), {
          status: 502,
        })
      );

      const error = await PlaylistsService.listWidgetChoices(
        baseUrl,
        organizationId,
        1,
        'f',
        request
      ).catch((e) => e);

      expect(error).toBeInstanceOf(WidgetChoicesError);
      expect(error.code).toBe('provider_error');
      expect(error.status).toBe(502);
    });

    it('uses unknown for responses without a code', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        new Response('<html>', { status: 500 })
      );

      await expect(
        PlaylistsService.listWidgetChoices(
          baseUrl,
          organizationId,
          1,
          'f',
          request
        )
      ).rejects.toMatchObject({ code: 'unknown', status: 500 });
    });

    it('reports network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('offline'));

      await expect(
        PlaylistsService.listWidgetChoices(
          baseUrl,
          organizationId,
          1,
          'f',
          request
        )
      ).rejects.toMatchObject({ code: 'network_error' });
    });
  });
});
