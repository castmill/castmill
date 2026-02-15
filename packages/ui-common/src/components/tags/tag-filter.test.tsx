/** @jsxImportSource solid-js */

import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { TagFilter } from './tag-filter';
import type { Tag } from '../../services/tags.service';

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

describe('TagFilter', () => {
  afterEach(cleanup);

  const tag1 = createTag({ id: 1, name: 'London', color: '#3B82F6' });
  const tag2 = createTag({ id: 2, name: 'Berlin', color: '#10B981' });
  const tag3 = createTag({ id: 3, name: 'Tokyo', color: '#F59E0B' });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  it('renders with default placeholder', () => {
    const { getByText } = render(() => (
      <TagFilter
        tags={[tag1, tag2]}
        selectedTagIds={[]}
        onTagChange={vi.fn()}
      />
    ));

    // MultiSelectFilter renders the placeholder when nothing is selected
    expect(getByText('Filter by tags…')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    const { getByText } = render(() => (
      <TagFilter
        tags={[tag1, tag2]}
        selectedTagIds={[]}
        onTagChange={vi.fn()}
        placeholder="Choose tags"
      />
    ));

    expect(getByText('Choose tags')).toBeInTheDocument();
  });

  it('renders with label', () => {
    const { getByText } = render(() => (
      <TagFilter
        tags={[tag1]}
        selectedTagIds={[]}
        onTagChange={vi.fn()}
        label="Tags"
      />
    ));

    expect(getByText('Tags')).toBeInTheDocument();
  });

  it('renders selected tags as chips', () => {
    const { getByText } = render(() => (
      <TagFilter
        tags={[tag1, tag2, tag3]}
        selectedTagIds={[1, 2]}
        onTagChange={vi.fn()}
      />
    ));

    // Selected tags should appear as chips
    expect(getByText('London')).toBeInTheDocument();
    expect(getByText('Berlin')).toBeInTheDocument();
  });

  // ===========================================================================
  // Interactions
  // ===========================================================================

  it('opens dropdown when clicked', async () => {
    const { getByText, container } = render(() => (
      <TagFilter
        tags={[tag1, tag2, tag3]}
        selectedTagIds={[]}
        onTagChange={vi.fn()}
      />
    ));

    // Click the trigger/placeholder to open
    await fireEvent.click(getByText('Filter by tags…'));

    // The dropdown panel should be visible
    const panel = container.querySelector('.msf-panel');
    expect(panel).toBeInTheDocument();
  });

  it('calls onTagChange when a tag is selected', async () => {
    const onTagChange = vi.fn();
    const { getByText } = render(() => (
      <TagFilter
        tags={[tag1, tag2, tag3]}
        selectedTagIds={[]}
        onTagChange={onTagChange}
      />
    ));

    // Open the dropdown
    await fireEvent.click(getByText('Filter by tags…'));

    // Click on a tag option
    await fireEvent.click(getByText('London'));

    expect(onTagChange).toHaveBeenCalledWith([1]);
  });

  it('renders tag options with color dots', async () => {
    const { getByText, container } = render(() => (
      <TagFilter
        tags={[tag1, tag2]}
        selectedTagIds={[]}
        onTagChange={vi.fn()}
      />
    ));

    // Open the dropdown
    await fireEvent.click(getByText('Filter by tags…'));

    // Check for color dots in the rendered tag items
    const colorDots = container.querySelectorAll('.tag-color-dot');
    expect(colorDots.length).toBeGreaterThan(0);
  });

  // ===========================================================================
  // Disabled State
  // ===========================================================================

  it('applies disabled state', () => {
    const { container } = render(() => (
      <TagFilter
        tags={[tag1]}
        selectedTagIds={[]}
        onTagChange={vi.fn()}
        disabled={true}
      />
    ));

    const wrapper = container.querySelector('.castmill-msf');
    expect(wrapper).toHaveClass('disabled');
  });

  // ===========================================================================
  // Filter Mode Toggle
  // ===========================================================================

  it('renders filter mode toggle when showFilterModeToggle is true and multiple items selected', async () => {
    // Mode bar only appears when selectedItems().length > 1
    const { container } = render(() => (
      <TagFilter
        tags={[tag1, tag2, tag3]}
        selectedTagIds={[1, 2]}
        onTagChange={vi.fn()}
        showFilterModeToggle={true}
        filterMode="any"
        onFilterModeChange={vi.fn()}
      />
    ));

    // Open the dropdown by clicking the trigger
    const trigger = container.querySelector('.msf-trigger') as HTMLElement;
    await fireEvent.click(trigger);

    // Mode toggle should be visible inside panel
    const modeButtons = container.querySelectorAll('.msf-mode-btn');
    expect(modeButtons.length).toBe(2);
  });

  it('calls onFilterModeChange when mode toggle is clicked', async () => {
    const onFilterModeChange = vi.fn();
    // Need 2+ selections to show mode bar
    const { container } = render(() => (
      <TagFilter
        tags={[tag1, tag2, tag3]}
        selectedTagIds={[1, 2]}
        onTagChange={vi.fn()}
        showFilterModeToggle={true}
        filterMode="any"
        onFilterModeChange={onFilterModeChange}
      />
    ));

    // Open the dropdown
    const trigger = container.querySelector('.msf-trigger') as HTMLElement;
    await fireEvent.click(trigger);

    // Click the "All" mode button
    const allButton = container.querySelectorAll(
      '.msf-mode-btn'
    )[1] as HTMLElement;
    await fireEvent.click(allButton);

    expect(onFilterModeChange).toHaveBeenCalledWith('all');
  });
});
