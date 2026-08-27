/**
 * Custom hook for managing tag filtering in resource pages
 *
 * This hook provides tag fetching and filtering logic that can be reused
 * across all resource pages (medias, playlists, devices, channels).
 *
 * Features:
 * - Tag selection persisted in localStorage per organization
 * - Optional URL parameter reading for shareable filtered views
 * - Automatic validation of URL params against loaded tags
 * - Consistent behavior across dashboard and addon components
 * - Multi-select support (filter by multiple tags)
 *
 * URL Parameter Support:
 * When params is provided, the hook reads ?tags=1,2,3 from the URL on mount
 * and validates them against the loaded tags. If valid, it sets the initial
 * selection. This enables shareable links like /org/123/content/playlists?tags=5,6
 */

import { createEffect, createSignal, on } from 'solid-js';
import { Tag, TagsService } from '../services/tags.service';

// Type aliases for URL params
type SearchParams = Record<string, string | undefined>;
type SetSearchParams = (
  params: Record<string, string | number | boolean | undefined>,
  options?: any
) => void;

interface UseTagFilterProps {
  baseUrl: string;
  organizationId: string;
  /**
   * Optional URL search params tuple from useSearchParams() or props.params
   * Enables reading ?tags=1,2,3 from URL for initial tag selection
   */
  params?: [SearchParams, SetSearchParams];
  /**
   * Filter mode: 'any' (OR) or 'all' (AND)
   * Default: 'any'
   */
  filterMode?: 'any' | 'all';
}

interface UseTagFilterReturn {
  tags: () => Tag[];
  selectedTagIds: () => number[];
  setSelectedTagIds: (tagIds: number[]) => void;
  toggleTagId: (tagId: number) => void;
  clearTagSelection: () => void;
  filterMode: () => 'any' | 'all';
  setFilterMode: (mode: 'any' | 'all') => void;
  isLoading: () => boolean;
}

const STORAGE_KEY_PREFIX = 'castmill_selected_tags_';
const FILTER_MODE_KEY_PREFIX = 'castmill_tag_filter_mode_';

const parseTagIdsParam = (value: string | undefined): number[] => {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return [];
  }

  return value
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id));
};

/**
 * Get the localStorage key for a specific organization
 */
const getStorageKey = (organizationId: string): string => {
  return `${STORAGE_KEY_PREFIX}${organizationId}`;
};

const getFilterModeKey = (organizationId: string): string => {
  return `${FILTER_MODE_KEY_PREFIX}${organizationId}`;
};

/**
 * Load the selected tag IDs from localStorage for an organization
 */
const loadSelectedTagIds = (organizationId: string): number[] => {
  try {
    const key = getStorageKey(organizationId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === 'number' && !isNaN(id));
      }
    }
  } catch (error) {
    console.error('Failed to load selected tags from localStorage:', error);
  }
  return [];
};

/**
 * Save the selected tag IDs to localStorage
 */
const saveSelectedTagIds = (organizationId: string, tagIds: number[]): void => {
  try {
    const key = getStorageKey(organizationId);
    localStorage.setItem(key, JSON.stringify(tagIds));
  } catch (error) {
    console.error('Failed to save selected tags to localStorage:', error);
  }
};

/**
 * Load the filter mode from localStorage
 */
const loadFilterMode = (organizationId: string): 'any' | 'all' => {
  try {
    const key = getFilterModeKey(organizationId);
    const stored = localStorage.getItem(key);
    if (stored === 'any' || stored === 'all') {
      return stored;
    }
  } catch (error) {
    console.error('Failed to load filter mode from localStorage:', error);
  }
  return 'any';
};

/**
 * Save the filter mode to localStorage
 */
const saveFilterMode = (organizationId: string, mode: 'any' | 'all'): void => {
  try {
    const key = getFilterModeKey(organizationId);
    localStorage.setItem(key, mode);
  } catch (error) {
    console.error('Failed to save filter mode to localStorage:', error);
  }
};

export function useTagFilter(props: UseTagFilterProps): UseTagFilterReturn {
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIdsInternal] = createSignal<number[]>(
    []
  );
  const [filterMode, setFilterModeInternal] = createSignal<'any' | 'all'>(
    props.filterMode || 'any'
  );
  const [isLoading, setIsLoading] = createSignal(true);

  const tagsService = new TagsService(props.baseUrl);

  // Fetch tags on mount and when organization changes
  createEffect(
    on(
      () => props.organizationId,
      async (orgId) => {
        if (!orgId) {
          setTags([]);
          setSelectedTagIdsInternal([]);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        try {
          const fetchedTags = await tagsService.listTags(orgId);
          setTags(fetchedTags);

          // Check URL params first for initial selection
          const urlTagIds = props.params
            ? parseTagIdsParam(props.params[0]?.tags)
            : [];

          // Validate URL tag IDs against loaded tags
          const validTagIds = fetchedTags.map((t) => t.id);
          const validUrlTagIds = urlTagIds.filter((id) =>
            validTagIds.includes(id)
          );

          if (validUrlTagIds.length > 0) {
            // URL params take precedence
            setSelectedTagIdsInternal(validUrlTagIds);
            saveSelectedTagIds(orgId, validUrlTagIds);
          } else {
            // Fall back to localStorage
            const storedTagIds = loadSelectedTagIds(orgId);
            const validStoredTagIds = storedTagIds.filter((id) =>
              validTagIds.includes(id)
            );
            setSelectedTagIdsInternal(validStoredTagIds);

            // Clean up invalid tags from storage
            if (validStoredTagIds.length !== storedTagIds.length) {
              saveSelectedTagIds(orgId, validStoredTagIds);
            }
          }

          // Load filter mode from localStorage
          const storedFilterMode = loadFilterMode(orgId);
          setFilterModeInternal(storedFilterMode);
        } catch (error) {
          console.error('Failed to fetch tags:', error);
          setTags([]);
        } finally {
          setIsLoading(false);
        }
      },
      { defer: false }
    )
  );

  // Update URL when selection changes (if params provided)
  createEffect(
    on(
      () => selectedTagIds(),
      (ids) => {
        if (props.params) {
          const [, setSearchParams] = props.params;
          const tagsParam = ids.length > 0 ? ids.join(',') : undefined;
          setSearchParams({ tags: tagsParam }, { replace: true });
        }
      },
      { defer: true }
    )
  );

  const setSelectedTagIds = (tagIds: number[]) => {
    setSelectedTagIdsInternal(tagIds);
    saveSelectedTagIds(props.organizationId, tagIds);
  };

  const toggleTagId = (tagId: number) => {
    const current = selectedTagIds();
    const newSelection = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    setSelectedTagIds(newSelection);
  };

  const clearTagSelection = () => {
    setSelectedTagIds([]);
  };

  const setFilterMode = (mode: 'any' | 'all') => {
    setFilterModeInternal(mode);
    saveFilterMode(props.organizationId, mode);
  };

  return {
    tags,
    selectedTagIds,
    setSelectedTagIds,
    toggleTagId,
    clearTagSelection,
    filterMode,
    setFilterMode,
    isLoading,
  };
}
