/**
 * Custom hook for managing reactive tag filter effects
 *
 * This hook encapsulates the common pattern of reactively refreshing data
 * when tag selection or filter mode changes. It's used across all resource
 * pages (devices, medias, playlists, channels) to maintain DRY principles.
 *
 * Features:
 * - Automatic reactive refresh when tags or filter mode changes
 * - Deferred execution to avoid initial load duplication
 * - Provides handleTagChange callback for TagFilter component
 */

import { Accessor, createEffect, on, Setter } from 'solid-js';

export interface UseTagFilterEffectProps {
  /**
   * Signal accessor for selected tag IDs
   */
  selectedTagIds: Accessor<number[]>;

  /**
   * Signal setter for selected tag IDs
   */
  setSelectedTagIds: Setter<number[]>;

  /**
   * Signal accessor for tag filter mode ('any' or 'all')
   */
  tagFilterMode: Accessor<'any' | 'all'>;

  /**
   * Callback to refresh table data when tags/mode change
   */
  onRefreshData: () => void;

  /**
   * Callback to refresh tree view when tags/mode change
   */
  onRefreshTree: () => void;
}

export interface UseTagFilterEffectReturn {
  /**
   * Handler for TagFilter component's onChange callback
   * Sets the selected tag IDs and triggers reactive refresh
   */
  handleTagChange: (tagIds: number[]) => void;
}

/**
 * Sets up reactive effects for tag filtering and provides change handler
 *
 * @example
 * ```tsx
 * const { handleTagChange } = useTagFilterEffect({
 *   selectedTagIds,
 *   setSelectedTagIds,
 *   tagFilterMode,
 *   onRefreshData: refreshData,
 *   onRefreshTree: bumpTree,
 * });
 *
 * <TagFilter
 *   tags={tags()}
 *   selectedTagIds={selectedTagIds()}
 *   onChange={handleTagChange}
 * />
 * ```
 */
export function useTagFilterEffect(
  props: UseTagFilterEffectProps
): UseTagFilterEffectReturn {
  // Reactively refresh table & tree when tag selection or filter mode changes
  // (covers both user interaction and initial load from URL/localStorage)
  createEffect(
    on(
      () => [props.selectedTagIds(), props.tagFilterMode()] as const,
      () => {
        props.onRefreshData();
        props.onRefreshTree();
      },
      { defer: true }
    )
  );

  const handleTagChange = (tagIds: number[]) => {
    props.setSelectedTagIds(tagIds);
  };

  return {
    handleTagChange,
  };
}
