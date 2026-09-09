/** @jsxImportSource solid-js */

/**
 * TagPopover Component
 *
 * A floating popover for toggling tags on one or more resources.
 * Renders via Portal for clean z-index stacking. Supports:
 * - Grouped tag layout (by TagGroup, with an "Other" section for ungrouped)
 * - Real-time search filtering
 * - Inline tag creation
 * - Per-tag loading state during async toggles
 * - Smart viewport-aware positioning
 * - Keyboard navigation (Escape to close, Enter to create)
 */

import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onCleanup,
  onMount,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { IoAddCircle } from 'solid-icons/io';
import { BsSearch } from 'solid-icons/bs';
import type { Tag, TagGroup } from '../../services/tags.service';

import './tag-popover.scss';

export interface TagPopoverProps {
  /** All tags available in the organization */
  availableTags: Tag[];
  /** Tag groups for organized display */
  tagGroups?: TagGroup[];
  /** IDs of tags currently assigned to the target resource(s) */
  selectedTagIds: number[];
  /** Called when a tag checkbox is toggled. Receives tagId and the new checked state. */
  onToggle: (tagId: number, selected: boolean) => void | Promise<void>;
  /** Optional handler to create a new tag inline */
  onCreateTag?: (name: string) => Promise<Tag>;
  /** The DOM element to anchor the popover to */
  anchorEl: HTMLElement;
  /** Close callback */
  onClose: () => void;
  /** Whether inline tag creation is allowed */
  allowCreate?: boolean;
  /** Search input placeholder */
  placeholder?: string;
  /** Header for the ungrouped section */
  ungroupedLabel?: string;
  /** Empty state when no tags exist */
  emptyLabel?: string;
  /** Empty state when search yields no results */
  noMatchLabel?: string;
  /** Optional title shown at the top (e.g. "Tag 3 items") */
  title?: string;
}

export const TagPopover: Component<TagPopoverProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);
  const [togglingTags, setTogglingTags] = createSignal(new Set<number>());
  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  const [visible, setVisible] = createSignal(false);

  let popoverRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // ---------------------------------------------------------------------------
  // Positioning
  // ---------------------------------------------------------------------------

  const updatePosition = () => {
    if (!props.anchorEl) return;

    const rect = props.anchorEl.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverMaxHeight = 360;
    const gap = 6;

    let top = rect.bottom + gap;
    let left = rect.left + rect.width / 2 - popoverWidth / 2;

    // Flip above if not enough room below
    if (top + popoverMaxHeight > window.innerHeight - 8) {
      top = rect.top - popoverMaxHeight - gap;
    }

    // Clamp horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));

    setPosition({ top, left });
  };

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onMount(() => {
    updatePosition();
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => inputRef?.focus(), 50);

    // Delay adding click listener so the triggering click doesn't immediately close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
  });

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleScroll, true);
  });

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleClickOutside = (e: MouseEvent) => {
    if (
      popoverRef &&
      !popoverRef.contains(e.target as Node) &&
      !props.anchorEl.contains(e.target as Node)
    ) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  const handleResize = () => updatePosition();

  const handleScroll = () => props.onClose();

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const groupedTags = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    const filtered = query
      ? props.availableTags.filter((t) => t.name.toLowerCase().includes(query))
      : props.availableTags;

    const groups = (props.tagGroups || [])
      .map((g) => ({
        ...g,
        tags: filtered
          .filter((t) => t.tag_group_id === g.id)
          .sort((a, b) => a.position - b.position),
      }))
      .filter((g) => g.tags.length > 0);

    const ungrouped = filtered
      .filter((t) => !t.tag_group_id)
      .sort((a, b) => a.position - b.position);

    return { groups, ungrouped };
  });

  const totalFiltered = createMemo(() => {
    const { groups, ungrouped } = groupedTags();
    return groups.reduce((sum, g) => sum + g.tags.length, 0) + ungrouped.length;
  });

  const canCreate = createMemo(() => {
    if (!props.allowCreate || !props.onCreateTag) return false;
    const query = searchQuery().trim();
    if (!query || query.length < 2) return false;
    return !props.availableTags.some(
      (t) => t.name.toLowerCase() === query.toLowerCase()
    );
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const isTagSelected = (tagId: number) => props.selectedTagIds.includes(tagId);

  const isTagToggling = (tagId: number) => togglingTags().has(tagId);

  const handleToggle = async (tagId: number) => {
    if (isTagToggling(tagId)) return;

    const newState = !isTagSelected(tagId);
    setTogglingTags((prev) => {
      const next = new Set(prev);
      next.add(tagId);
      return next;
    });

    try {
      await props.onToggle(tagId, newState);
    } finally {
      setTogglingTags((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    }
  };

  const handleCreateTag = async () => {
    if (!props.onCreateTag || isCreating()) return;
    const name = searchQuery().trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const newTag = await props.onCreateTag(name);
      setSearchQuery('');
      // Auto-select the freshly created tag
      await props.onToggle(newTag.id, true);
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderTagRow = (tag: Tag) => (
    <button
      class={`tag-popover-row ${isTagSelected(tag.id) ? 'selected' : ''} ${isTagToggling(tag.id) ? 'toggling' : ''}`}
      onClick={() => handleToggle(tag.id)}
      disabled={isTagToggling(tag.id)}
      type="button"
    >
      <span
        class={`tag-popover-check ${isTagSelected(tag.id) ? 'checked' : ''}`}
      >
        <Show when={isTagSelected(tag.id)}>
          <svg viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </Show>
      </span>
      <span class="tag-popover-dot" style={{ 'background-color': tag.color }} />
      <span class="tag-popover-name">{tag.name}</span>
    </button>
  );

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <Portal>
      <div
        ref={(el) => (popoverRef = el)}
        class={`castmill-tag-popover ${visible() ? 'visible' : ''}`}
        style={{
          top: `${position().top}px`,
          left: `${position().left}px`,
        }}
        role="dialog"
        aria-label="Tag selector"
      >
        {/* Optional title */}
        <Show when={props.title}>
          <div class="tag-popover-title">{props.title}</div>
        </Show>

        {/* Search field */}
        <div class="tag-popover-search">
          <BsSearch class="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder={props.placeholder || 'Search tags...'}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate()) {
                e.preventDefault();
                handleCreateTag();
              }
            }}
          />
        </div>

        {/* Tag list */}
        <div class="tag-popover-list">
          <Show
            when={totalFiltered() > 0 || canCreate()}
            fallback={
              <div class="tag-popover-empty">
                {searchQuery()
                  ? props.noMatchLabel || 'No matching tags'
                  : props.emptyLabel || 'No tags available'}
              </div>
            }
          >
            {/* Grouped tags */}
            <For each={groupedTags().groups}>
              {(group) => (
                <div class="tag-popover-group">
                  <div class="tag-popover-group-header">
                    <Show when={group.color}>
                      <span
                        class="group-dot"
                        style={{ 'background-color': group.color }}
                      />
                    </Show>
                    {group.name}
                  </div>
                  <For each={group.tags}>{(tag) => renderTagRow(tag)}</For>
                </div>
              )}
            </For>

            {/* Ungrouped tags */}
            <Show when={groupedTags().ungrouped.length > 0}>
              <div class="tag-popover-group">
                <Show when={groupedTags().groups.length > 0}>
                  <div class="tag-popover-group-header">
                    {props.ungroupedLabel || 'Other'}
                  </div>
                </Show>
                <For each={groupedTags().ungrouped}>
                  {(tag) => renderTagRow(tag)}
                </For>
              </div>
            </Show>

            {/* Inline create option */}
            <Show when={canCreate()}>
              <div class="tag-popover-create">
                <button
                  type="button"
                  class="tag-popover-create-btn"
                  onClick={handleCreateTag}
                  disabled={isCreating()}
                >
                  <IoAddCircle />
                  <span>
                    {isCreating()
                      ? 'Creating...'
                      : `Create "${searchQuery().trim()}"`}
                  </span>
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </Portal>
  );
};
