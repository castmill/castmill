/** @jsxImportSource solid-js */

/**
 * TagEditor Component
 *
 * A component for managing tags on a specific resource.
 * Allows adding and removing tags with a user-friendly interface.
 */

import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import { IoAddCircle } from 'solid-icons/io';
import type { Tag } from '../../services/tags.service';
import { TagBadge } from './tag-badge';

import './tag-editor.scss';

export interface TagEditorProps {
  availableTags: Tag[];
  selectedTags: Tag[];
  onTagAdd: (tag: Tag) => void;
  onTagRemove: (tag: Tag) => void;
  onCreateTag?: (name: string) => Promise<Tag>;
  label?: string;
  placeholder?: string;
  addLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  allowCreate?: boolean;
  maxTags?: number;
}

export const TagEditor: Component<TagEditorProps> = (props) => {
  const [isAdding, setIsAdding] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;

  // Available tags that aren't already selected
  const unselectedTags = createMemo(() =>
    props.availableTags.filter(
      (tag) => !props.selectedTags.some((st) => st.id === tag.id)
    )
  );

  // Filtered tags based on search
  const filteredTags = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return unselectedTags();
    return unselectedTags().filter((tag) =>
      tag.name.toLowerCase().includes(query)
    );
  });

  // Check if can create new tag
  const canCreate = createMemo(() => {
    if (!props.allowCreate || !props.onCreateTag) return false;
    const query = searchQuery().trim();
    if (!query) return false;
    // Don't allow creating if tag with same name exists
    const exists = props.availableTags.some(
      (tag) => tag.name.toLowerCase() === query.toLowerCase()
    );
    return !exists;
  });

  // Check if max tags reached
  const maxReached = createMemo(() =>
    props.maxTags ? props.selectedTags.length >= props.maxTags : false
  );

  const openDropdown = () => {
    if (props.disabled || maxReached()) return;
    setIsAdding(true);
    setSearchQuery('');
    setTimeout(() => inputRef?.focus(), 0);
  };

  const closeDropdown = () => {
    setIsAdding(false);
    setSearchQuery('');
  };

  const handleAddTag = (tag: Tag) => {
    props.onTagAdd(tag);
    setSearchQuery('');
    inputRef?.focus();
  };

  const handleCreateTag = async () => {
    if (!props.onCreateTag || isCreating()) return;

    const name = searchQuery().trim();
    if (!name) return;

    setIsCreating(true);
    try {
      const newTag = await props.onCreateTag(name);
      props.onTagAdd(newTag);
      setSearchQuery('');
      inputRef?.focus();
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      closeDropdown();
    }
  };

  // Manage click outside listener
  createMemo(() => {
    if (isAdding()) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDropdown();
    } else if (e.key === 'Enter' && canCreate()) {
      e.preventDefault();
      handleCreateTag();
    }
  };

  return (
    <div
      class={`castmill-tag-editor ${props.disabled ? 'disabled' : ''} ${props.loading ? 'loading' : ''}`}
      ref={(el) => (dropdownRef = el)}
    >
      <Show when={props.label}>
        <label class="tag-editor-label">{props.label}</label>
      </Show>

      <div class="tag-editor-content">
        {/* Selected tags */}
        <div class="selected-tags-container">
          <For each={props.selectedTags}>
            {(tag) => (
              <TagBadge
                tag={tag}
                removable
                onRemove={() => props.onTagRemove(tag)}
                disabled={props.disabled || props.loading}
              />
            )}
          </For>

          {/* Add tag button/input */}
          <Show
            when={!isAdding()}
            fallback={
              <div class="add-tag-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  class="add-tag-input"
                  placeholder={props.placeholder || 'Search tags...'}
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  disabled={props.disabled || props.loading}
                />
              </div>
            }
          >
            <Show when={!maxReached() && unselectedTags().length > 0}>
              <button
                type="button"
                class="add-tag-button"
                onClick={openDropdown}
                disabled={props.disabled || props.loading}
              >
                <IoAddCircle />
                <span>{props.addLabel || 'Add tag'}</span>
              </button>
            </Show>
          </Show>
        </div>

        {/* Dropdown */}
        <Show when={isAdding()}>
          <div class="tag-editor-dropdown">
            <Show
              when={filteredTags().length > 0 || canCreate()}
              fallback={
                <div class="no-tags-message">
                  {searchQuery()
                    ? 'No matching tags'
                    : unselectedTags().length === 0
                      ? 'All tags assigned'
                      : 'No tags available'}
                </div>
              }
            >
              <div class="tag-options-list">
                <For each={filteredTags()}>
                  {(tag) => (
                    <div
                      class="tag-option"
                      onClick={() => handleAddTag(tag)}
                      role="option"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAddTag(tag);
                        }
                      }}
                    >
                      <span
                        class="tag-color-dot"
                        style={{ 'background-color': tag.color }}
                      />
                      <span class="tag-option-name">{tag.name}</span>
                    </div>
                  )}
                </For>

                {/* Create new tag option */}
                <Show when={canCreate()}>
                  <div
                    class="tag-option create-option"
                    onClick={handleCreateTag}
                    role="option"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCreateTag();
                      }
                    }}
                  >
                    <IoAddCircle />
                    <span class="create-text">
                      {isCreating()
                        ? 'Creating...'
                        : `Create "${searchQuery().trim()}"`}
                    </span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>

        {/* Max tags message */}
        <Show when={maxReached()}>
          <div class="max-tags-message">
            Maximum {props.maxTags} tags reached
          </div>
        </Show>
      </div>
    </div>
  );
};
