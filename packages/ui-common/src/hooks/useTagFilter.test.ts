import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { useTagFilter } from './useTagFilter';

// Mock TagsService
vi.mock('../services/tags.service', () => {
  return {
    TagsService: vi.fn().mockImplementation(() => ({
      listTags: vi.fn().mockResolvedValue([]),
    })),
  };
});

function createMockTags() {
  return [
    {
      id: 1,
      name: 'London',
      color: '#3B82F6',
      position: 0,
      organization_id: 'org-1',
      inserted_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 2,
      name: 'Berlin',
      color: '#10B981',
      position: 1,
      organization_id: 'org-1',
      inserted_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 3,
      name: 'Tokyo',
      color: '#F59E0B',
      position: 2,
      organization_id: 'org-1',
      inserted_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ];
}

describe('useTagFilter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Helper utility functions (exported from the module but tested indirectly)
  // ===========================================================================

  describe('parseTagIdsParam', () => {
    // We test this indirectly through the hook's URL param handling
    it('hook initializes with empty selection by default', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-1',
          });

          // Wait for the effect to settle
          await new Promise((r) => setTimeout(r, 50));

          expect(result.selectedTagIds()).toEqual([]);
          expect(result.tags().length).toBe(3);

          dispose();
          resolve();
        });
      });
    });
  });

  describe('localStorage persistence', () => {
    it('saves selected tag IDs to localStorage', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-test-save',
          });

          await new Promise((r) => setTimeout(r, 50));

          result.setSelectedTagIds([1, 2]);

          const stored = localStorage.getItem(
            'castmill_selected_tags_org-test-save'
          );
          expect(stored).toBe('[1,2]');

          dispose();
          resolve();
        });
      });
    });

    it('loads selected tag IDs from localStorage', async () => {
      localStorage.setItem(
        'castmill_selected_tags_org-load-test',
        JSON.stringify([1, 3])
      );

      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-load-test',
          });

          await new Promise((r) => setTimeout(r, 50));

          // Should only include IDs that exist in loaded tags
          expect(result.selectedTagIds()).toEqual([1, 3]);

          dispose();
          resolve();
        });
      });
    });

    it('filters out invalid tag IDs from localStorage', async () => {
      // Store tag IDs that don't exist in the fetched tags
      localStorage.setItem(
        'castmill_selected_tags_org-invalid',
        JSON.stringify([1, 999, 2])
      );

      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-invalid',
          });

          await new Promise((r) => setTimeout(r, 50));

          // 999 should be filtered out
          expect(result.selectedTagIds()).toEqual([1, 2]);

          dispose();
          resolve();
        });
      });
    });
  });

  describe('filterMode', () => {
    it('defaults to "any"', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue([]),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-mode-default',
          });

          expect(result.filterMode()).toBe('any');

          dispose();
          resolve();
        });
      });
    });

    it('persists filter mode to localStorage', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue([]),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-mode-persist',
          });

          await new Promise((r) => setTimeout(r, 50));

          result.setFilterMode('all');

          const stored = localStorage.getItem(
            'castmill_tag_filter_mode_org-mode-persist'
          );
          expect(stored).toBe('all');

          dispose();
          resolve();
        });
      });
    });

    it('loads filter mode from localStorage', async () => {
      localStorage.setItem('castmill_tag_filter_mode_org-mode-load', 'all');

      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-mode-load',
          });

          await new Promise((r) => setTimeout(r, 50));

          expect(result.filterMode()).toBe('all');

          dispose();
          resolve();
        });
      });
    });
  });

  describe('toggleTagId', () => {
    it('adds a tag ID when not selected', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-toggle-add',
          });

          await new Promise((r) => setTimeout(r, 50));

          result.toggleTagId(1);
          expect(result.selectedTagIds()).toContain(1);

          dispose();
          resolve();
        });
      });
    });

    it('removes a tag ID when already selected', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-toggle-remove',
          });

          await new Promise((r) => setTimeout(r, 50));

          result.setSelectedTagIds([1, 2]);
          result.toggleTagId(1);
          expect(result.selectedTagIds()).toEqual([2]);

          dispose();
          resolve();
        });
      });
    });
  });

  describe('clearTagSelection', () => {
    it('clears all selected tags', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-clear',
          });

          await new Promise((r) => setTimeout(r, 50));

          result.setSelectedTagIds([1, 2, 3]);
          expect(result.selectedTagIds().length).toBe(3);

          result.clearTagSelection();
          expect(result.selectedTagIds()).toEqual([]);

          dispose();
          resolve();
        });
      });
    });
  });

  describe('URL params handling', () => {
    it('reads tag IDs from URL params on mount', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      const setSearchParams = vi.fn();
      const params: [
        Record<string, string | undefined>,
        typeof setSearchParams,
      ] = [{ tags: '1,3' }, setSearchParams];

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-url-read',
            params,
          });

          await new Promise((r) => setTimeout(r, 50));

          // URL params should take precedence over localStorage
          expect(result.selectedTagIds()).toEqual([1, 3]);

          dispose();
          resolve();
        });
      });
    });

    it('ignores invalid tag IDs from URL params', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      const setSearchParams = vi.fn();
      const params: [
        Record<string, string | undefined>,
        typeof setSearchParams,
      ] = [{ tags: '1,999,abc' }, setSearchParams];

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-url-invalid',
            params,
          });

          await new Promise((r) => setTimeout(r, 50));

          // Only valid IDs should be set (999 doesn't exist in mock, abc is NaN)
          expect(result.selectedTagIds()).toEqual([1]);

          dispose();
          resolve();
        });
      });
    });

    it('handles empty/undefined tags param gracefully', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      const setSearchParams = vi.fn();
      const params: [
        Record<string, string | undefined>,
        typeof setSearchParams,
      ] = [{ tags: undefined }, setSearchParams];

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-url-empty',
            params,
          });

          await new Promise((r) => setTimeout(r, 50));

          expect(result.selectedTagIds()).toEqual([]);

          dispose();
          resolve();
        });
      });
    });

    it('handles "null" and "undefined" string values', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue(createMockTags()),
      }));

      const setSearchParams = vi.fn();
      const params: [
        Record<string, string | undefined>,
        typeof setSearchParams,
      ] = [{ tags: 'null' }, setSearchParams];

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-url-null',
            params,
          });

          await new Promise((r) => setTimeout(r, 50));

          expect(result.selectedTagIds()).toEqual([]);

          dispose();
          resolve();
        });
      });
    });
  });

  describe('isLoading', () => {
    it('starts as loading', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue([]),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-loading',
          });

          // Initially loading
          expect(result.isLoading()).toBe(true);

          await new Promise((r) => setTimeout(r, 50));

          // After fetch completes
          expect(result.isLoading()).toBe(false);

          dispose();
          resolve();
        });
      });
    });
  });

  describe('error handling', () => {
    it('sets empty tags on fetch error', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockRejectedValue(new Error('Network error')),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: 'org-error',
          });

          await new Promise((r) => setTimeout(r, 50));

          expect(result.tags()).toEqual([]);
          expect(result.isLoading()).toBe(false);

          consoleSpy.mockRestore();
          dispose();
          resolve();
        });
      });
    });
  });

  describe('empty organizationId', () => {
    it('clears tags when organizationId is empty', async () => {
      const { TagsService } = await import('../services/tags.service');
      (TagsService as any).mockImplementation(() => ({
        listTags: vi.fn().mockResolvedValue([]),
      }));

      await new Promise<void>((resolve) => {
        createRoot(async (dispose) => {
          const result = useTagFilter({
            baseUrl: 'http://localhost:4000',
            organizationId: '',
          });

          await new Promise((r) => setTimeout(r, 50));

          expect(result.tags()).toEqual([]);
          expect(result.selectedTagIds()).toEqual([]);
          expect(result.isLoading()).toBe(false);

          dispose();
          resolve();
        });
      });
    });
  });
});
