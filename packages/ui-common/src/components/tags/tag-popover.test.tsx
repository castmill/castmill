/** @jsxImportSource solid-js */

import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { TagPopover } from './tag-popover';
import type { Tag, TagGroup } from '../../services/tags.service';

function createTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'Test Tag',
    color: '#3B82F6',
    position: 0,
    organization_id: 'org-1',
    inserted_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createTagGroup(overrides: Partial<TagGroup> = {}): TagGroup {
  return {
    id: 1,
    name: 'Location',
    color: '#FF0000',
    position: 0,
    organization_id: 'org-1',
    inserted_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TagPopover', () => {
  let anchorEl: HTMLElement;

  beforeEach(() => {
    anchorEl = document.createElement('button');
    anchorEl.textContent = 'Anchor';
    document.body.appendChild(anchorEl);

    // Mock getBoundingClientRect for positioning
    anchorEl.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      bottom: 130,
      left: 200,
      right: 300,
      width: 100,
      height: 30,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.removeChild(anchorEl);
  });

  const tag1 = createTag({ id: 1, name: 'London', color: '#3B82F6' });
  const tag2 = createTag({ id: 2, name: 'Berlin', color: '#10B981' });
  const tag3 = createTag({ id: 3, name: 'Tokyo', color: '#F59E0B' });
  const tagInGroup = createTag({
    id: 4,
    name: 'Paris',
    color: '#EC4899',
    tag_group_id: 1,
  });
  const tagInGroup2 = createTag({
    id: 5,
    name: 'Madrid',
    color: '#8B5CF6',
    tag_group_id: 1,
  });

  const group1 = createTagGroup({ id: 1, name: 'Region', color: '#FF0000' });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  it('renders via Portal with dialog role', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1, tag2]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
  });

  it('renders all available tags', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1, tag2, tag3]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    expect(document.body).toHaveTextContent('London');
    expect(document.body).toHaveTextContent('Berlin');
    expect(document.body).toHaveTextContent('Tokyo');
  });

  it('shows title when provided', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        title="Tag 3 items"
      />
    ));

    expect(document.body).toHaveTextContent('Tag 3 items');
  });

  it('renders search input with default placeholder', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const input = document.querySelector('input[placeholder="Search tags..."]');
    expect(input).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        placeholder="Find tags…"
      />
    ));

    const input = document.querySelector('input[placeholder="Find tags…"]');
    expect(input).toBeInTheDocument();
  });

  // ===========================================================================
  // Grouped Display
  // ===========================================================================

  it('groups tags by tag group', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1, tagInGroup, tagInGroup2]}
        tagGroups={[group1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    // Group header should appear
    expect(document.body).toHaveTextContent('Region');
    // "Other" section for ungrouped tags (tag1 has no group)
    expect(document.body).toHaveTextContent('Other');
  });

  it('does not show "Other" when no ungrouped tags', () => {
    render(() => (
      <TagPopover
        availableTags={[tagInGroup, tagInGroup2]}
        tagGroups={[group1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    // All tags are grouped, so "Other" shouldn't appear
    const headers = document.querySelectorAll('.tag-popover-group-header');
    const headerTexts = Array.from(headers).map((h) => h.textContent);
    expect(headerTexts).not.toContain('Other');
  });

  // ===========================================================================
  // Selection State
  // ===========================================================================

  it('shows checkmark for selected tags', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1, tag2]}
        selectedTagIds={[1]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const selectedRows = document.querySelectorAll('.tag-popover-row.selected');
    expect(selectedRows.length).toBe(1);
  });

  // ===========================================================================
  // Toggle Interaction
  // ===========================================================================

  it('calls onToggle when a tag row is clicked', async () => {
    const onToggle = vi.fn();

    render(() => (
      <TagPopover
        availableTags={[tag1, tag2]}
        selectedTagIds={[]}
        onToggle={onToggle}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const rows = document.querySelectorAll('.tag-popover-row');
    await fireEvent.click(rows[0]);

    expect(onToggle).toHaveBeenCalledWith(tag1.id, true);
  });

  it('calls onToggle with false when deselecting', async () => {
    const onToggle = vi.fn();

    render(() => (
      <TagPopover
        availableTags={[tag1, tag2]}
        selectedTagIds={[1]}
        onToggle={onToggle}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    // Click the selected tag to deselect
    const selectedRow = document.querySelector('.tag-popover-row.selected');
    await fireEvent.click(selectedRow!);

    expect(onToggle).toHaveBeenCalledWith(1, false);
  });

  // ===========================================================================
  // Search Filtering
  // ===========================================================================

  it('filters tags by search query', async () => {
    render(() => (
      <TagPopover
        availableTags={[tag1, tag2, tag3]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const input = document.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'lon' } });

    const rows = document.querySelectorAll('.tag-popover-row');
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveTextContent('London');
  });

  it('shows empty message when search has no results', async () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const input = document.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'zzzzz' } });

    expect(document.body).toHaveTextContent('No matching tags');
  });

  it('shows custom no-match label', async () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        noMatchLabel="Nothing found"
      />
    ));

    const input = document.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'zzzzz' } });

    expect(document.body).toHaveTextContent('Nothing found');
  });

  // ===========================================================================
  // Empty State
  // ===========================================================================

  it('shows empty label when no tags exist', () => {
    render(() => (
      <TagPopover
        availableTags={[]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        emptyLabel="No tags yet"
      />
    ));

    expect(document.body).toHaveTextContent('No tags yet');
  });

  // ===========================================================================
  // Inline Create
  // ===========================================================================

  it('shows create option when allowCreate and search term is new', async () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        allowCreate={true}
        onCreateTag={vi
          .fn()
          .mockResolvedValue(createTag({ id: 99, name: 'NewCity' }))}
      />
    ));

    const input = document.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'NewCity' } });

    expect(document.body).toHaveTextContent('Create "NewCity"');
  });

  it('does not show create option when term matches existing tag', async () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        allowCreate={true}
        onCreateTag={vi.fn()}
      />
    ));

    const input = document.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'London' } });

    const createBtns = document.querySelectorAll('.tag-popover-create-btn');
    expect(createBtns.length).toBe(0);
  });

  it('does not show create option when search term is too short', async () => {
    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
        allowCreate={true}
        onCreateTag={vi.fn()}
      />
    ));

    const input = document.querySelector('input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'A' } });

    const createBtns = document.querySelectorAll('.tag-popover-create-btn');
    expect(createBtns.length).toBe(0);
  });

  // ===========================================================================
  // Keyboard
  // ===========================================================================

  it('closes on Escape key', async () => {
    const onClose = vi.fn();

    render(() => (
      <TagPopover
        availableTags={[tag1]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={onClose}
      />
    ));

    await fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  // ===========================================================================
  // Color Dots
  // ===========================================================================

  it('renders color dots for each tag', () => {
    render(() => (
      <TagPopover
        availableTags={[tag1, tag2]}
        selectedTagIds={[]}
        onToggle={vi.fn()}
        anchorEl={anchorEl}
        onClose={vi.fn()}
      />
    ));

    const dots = document.querySelectorAll('.tag-popover-dot');
    expect(dots.length).toBe(2);
    expect((dots[0] as HTMLElement).style.backgroundColor).toBeTruthy();
  });
});
