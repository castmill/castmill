import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchService } from './search.service';

// Mock fetch globally
global.fetch = vi.fn();

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('calls the search endpoint with correct parameters', async () => {
      const mockResponse = {
        query: 'test',
        page: 1,
        page_size: 20,
        results: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await SearchService.search('org123', 'test', 1, 20);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/organizations/org123/search'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('includes query parameters in the request URL', async () => {
      const mockResponse = {
        query: 'my search',
        page: 2,
        page_size: 50,
        results: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await SearchService.search('org123', 'my search', 2, 50);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('query=my+search');
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('page_size=50');
    });

    it('returns search results with multiple resource types', async () => {
      const mockResponse = {
        query: 'video',
        page: 1,
        page_size: 20,
        results: [
          {
            resource_type: 'medias',
            data: [
              { id: '1', name: 'Video 1', description: 'First video' },
              { id: '2', name: 'Video 2' },
            ],
            count: 2,
            page: 1,
            page_size: 20,
            total_pages: 1,
          },
          {
            resource_type: 'playlists',
            data: [{ id: '3', name: 'Video Playlist' }],
            count: 1,
            page: 1,
            page_size: 20,
            total_pages: 1,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await SearchService.search('org123', 'video');

      expect(result.results).toHaveLength(2);
      expect(result.results[0].resource_type).toBe('medias');
      expect(result.results[0].data).toHaveLength(2);
      expect(result.results[1].resource_type).toBe('playlists');
      expect(result.results[1].data).toHaveLength(1);
    });

    it('handles empty search results', async () => {
      const mockResponse = {
        query: 'nonexistent',
        page: 1,
        page_size: 20,
        results: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await SearchService.search('org123', 'nonexistent');

      expect(result.results).toHaveLength(0);
    });

    it('uses default pagination values when not provided', async () => {
      const mockResponse = {
        query: 'test',
        page: 1,
        page_size: 20,
        results: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await SearchService.search('org123', 'test');

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('page=1');
      expect(callUrl).toContain('page_size=20');
    });

    it('handles API errors correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Search failed' }),
      });

      await expect(
        SearchService.search('org123', 'test')
      ).rejects.toThrow();
    });

    it('handles network errors correctly', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        SearchService.search('org123', 'test')
      ).rejects.toThrow('Network error');
    });

    it('properly encodes special characters in search query', async () => {
      const mockResponse = {
        query: 'search & test',
        page: 1,
        page_size: 20,
        results: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await SearchService.search('org123', 'search & test');

      const callUrl = (global.fetch as any).mock.calls[0][0];
      // The & should be encoded as %26
      expect(callUrl).toContain('query=search+%26+test');
    });

    it('handles pagination correctly', async () => {
      const mockResponse = {
        query: 'test',
        page: 3,
        page_size: 10,
        results: [
          {
            resource_type: 'medias',
            data: Array(10).fill({ id: '1', name: 'Test' }),
            count: 50,
            page: 3,
            page_size: 10,
            total_pages: 5,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await SearchService.search('org123', 'test', 3, 10);

      expect(result.page).toBe(3);
      expect(result.page_size).toBe(10);
      expect(result.results[0].total_pages).toBe(5);
    });
  });
});
