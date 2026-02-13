/** @jsxImportSource solid-js */

import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { TagEditor } from './tag-editor';
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

describe('TagEditor', () => {
  afterEach(cleanup);

  const tag1 = createTag({ id: 1, name: 'London', color: '#3B82F6' });
  const tag2 = createTag({ id: 2, name: 'Berlin', color: '#10B981' });
  const tag3 = createTag({ id: 3, name: 'Tokyo', color: '#F59E0B' });

  // ===========================================================================
  // Rendering
  // ===========================================================================

  it('renders selected tags as badges', () => {
    const { getByText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2, tag3]}
        selectedTags={[tag1, tag2]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    expect(getByText('London')).toBeInTheDocument();
    expect(getByText('Berlin')).toBeInTheDocument();
  });

  it('renders the label when provided', () => {
    const { getByText } = render(() => (
      <TagEditor
        availableTags={[tag1]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        label="Tags"
      />
    ));

    expect(getByText('Tags')).toBeInTheDocument();
  });

  it('renders the add button when there are unselected tags', () => {
    const { getByText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2]}
        selectedTags={[tag1]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    expect(getByText('Add tag')).toBeInTheDocument();
  });

  it('renders custom add label', () => {
    const { getByText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        addLabel="Assign tag"
      />
    ));

    expect(getByText('Assign tag')).toBeInTheDocument();
  });

  it('hides add button when all tags are selected', () => {
    const { queryByText } = render(() => (
      <TagEditor
        availableTags={[tag1]}
        selectedTags={[tag1]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    expect(queryByText('Add tag')).not.toBeInTheDocument();
  });

  // ===========================================================================
  // Dropdown Interactions
  // ===========================================================================

  it('opens dropdown when add button is clicked', async () => {
    const { getByText, container } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2, tag3]}
        selectedTags={[tag1]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));

    const dropdown = container.querySelector('.tag-editor-dropdown');
    expect(dropdown).toBeInTheDocument();
  });

  it('shows unselected tags in dropdown', async () => {
    const { getByText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2, tag3]}
        selectedTags={[tag1]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));

    // Berlin and Tokyo should appear in options (London already selected)
    expect(getByText('Berlin')).toBeInTheDocument();
    expect(getByText('Tokyo')).toBeInTheDocument();
  });

  it('calls onTagAdd when a tag option is clicked', async () => {
    const onTagAdd = vi.fn();
    const { getByText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2, tag3]}
        selectedTags={[tag1]}
        onTagAdd={onTagAdd}
        onTagRemove={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));
    await fireEvent.click(getByText('Berlin'));

    expect(onTagAdd).toHaveBeenCalledWith(tag2);
  });

  it('calls onTagRemove when remove button is clicked on a badge', async () => {
    const onTagRemove = vi.fn();
    const { container } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2]}
        selectedTags={[tag1]}
        onTagAdd={vi.fn()}
        onTagRemove={onTagRemove}
      />
    ));

    const removeBtn = container.querySelector('.tag-remove');
    expect(removeBtn).toBeInTheDocument();
    await fireEvent.click(removeBtn!);

    expect(onTagRemove).toHaveBeenCalledWith(tag1);
  });

  // ===========================================================================
  // Search Filtering
  // ===========================================================================

  it('filters dropdown options by search query', async () => {
    const { getByText, queryByText, getByPlaceholderText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2, tag3]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));

    const input = getByPlaceholderText('Search tags...');
    await fireEvent.input(input, { target: { value: 'Berl' } });

    expect(getByText('Berlin')).toBeInTheDocument();
    expect(queryByText('London')).not.toBeInTheDocument();
    expect(queryByText('Tokyo')).not.toBeInTheDocument();
  });

  it('shows "No matching tags" when search has no results', async () => {
    const { getByText, getByPlaceholderText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));

    const input = getByPlaceholderText('Search tags...');
    await fireEvent.input(input, { target: { value: 'zzzzz' } });

    expect(getByText('No matching tags')).toBeInTheDocument();
  });

  // ===========================================================================
  // Disabled & Max Tags
  // ===========================================================================

  it('applies disabled class and disables add button when disabled', () => {
    const { container } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        disabled={true}
      />
    ));

    const editor = container.querySelector('.castmill-tag-editor');
    expect(editor).toHaveClass('disabled');

    const addBtn = container.querySelector(
      '.add-tag-button'
    ) as HTMLButtonElement;
    expect(addBtn?.disabled).toBe(true);
  });

  it('shows max tags message when limit reached', () => {
    const { getByText, queryByText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2, tag3]}
        selectedTags={[tag1, tag2]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        maxTags={2}
      />
    ));

    expect(getByText('Maximum 2 tags reached')).toBeInTheDocument();
    expect(queryByText('Add tag')).not.toBeInTheDocument();
  });

  // ===========================================================================
  // Inline Create
  // ===========================================================================

  it('shows create option when allowCreate is true and search has no match', async () => {
    const { getByText, getByPlaceholderText } = render(() => (
      <TagEditor
        availableTags={[tag1]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        allowCreate={true}
        onCreateTag={vi
          .fn()
          .mockResolvedValue(createTag({ id: 99, name: 'New Tag' }))}
      />
    ));

    await fireEvent.click(getByText('Add tag'));

    const input = getByPlaceholderText('Search tags...');
    await fireEvent.input(input, { target: { value: 'New Tag' } });

    expect(getByText('Create "New Tag"')).toBeInTheDocument();
  });

  it('does not show create option when tag with same name exists', async () => {
    const { getByText, queryByText, getByPlaceholderText } = render(() => (
      <TagEditor
        availableTags={[tag1]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        allowCreate={true}
        onCreateTag={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));

    const input = getByPlaceholderText('Search tags...');
    await fireEvent.input(input, { target: { value: 'London' } });

    expect(queryByText(/Create/)).not.toBeInTheDocument();
  });

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================

  it('closes dropdown on Escape key', async () => {
    const { getByText, container, getByPlaceholderText } = render(() => (
      <TagEditor
        availableTags={[tag1, tag2]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
      />
    ));

    await fireEvent.click(getByText('Add tag'));
    const dropdown = container.querySelector('.tag-editor-dropdown');
    expect(dropdown).toBeInTheDocument();

    const input = getByPlaceholderText('Search tags...');
    await fireEvent.keyDown(input, { key: 'Escape' });

    // After Escape, dropdown should be closed
    expect(
      container.querySelector('.tag-editor-dropdown')
    ).not.toBeInTheDocument();
  });

  // ===========================================================================
  // Loading state
  // ===========================================================================

  it('applies loading class when loading', () => {
    const { container } = render(() => (
      <TagEditor
        availableTags={[tag1]}
        selectedTags={[]}
        onTagAdd={vi.fn()}
        onTagRemove={vi.fn()}
        loading={true}
      />
    ));

    const editor = container.querySelector('.castmill-tag-editor');
    expect(editor).toHaveClass('loading');
  });
});
