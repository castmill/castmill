/** @jsxImportSource solid-js */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { ResourceTreeView } from './resource-tree-view';
import type { Tag, TagGroup } from '../../services/tags.service';

const tag = (id: number, groupId: number, name: string): Tag => ({
  id,
  name,
  color: '#3366ff',
  position: id,
  tag_group_id: groupId,
  organization_id: 'org',
  inserted_at: '',
  updated_at: '',
});

const group = (id: number, name: string, tags: Tag[]): TagGroup => ({
  id,
  name,
  position: id,
  organization_id: 'org',
  tags,
  inserted_at: '',
  updated_at: '',
});

const locationTags = [tag(1, 1, 'Stockholm')];
const campaignTags = [tag(2, 2, 'Summer')];
const tagGroups = [
  group(1, 'Location', locationTags),
  group(2, 'Campaign', campaignTags),
];

const stubMatchMedia = (matches: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );

const renderTree = (dimensionLabel?: string) =>
  render(() => (
    <ResourceTreeView
      tagGroups={tagGroups}
      allTags={[...locationTags, ...campaignTags]}
      fetchResources={vi.fn().mockResolvedValue({ data: [], count: 0 })}
      dimensionLabel={dimensionLabel}
    />
  ));

describe('ResourceTreeView responsive dimension bar', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the dimension selectors inline on wide screens', () => {
    stubMatchMedia(false);
    const { container } = renderTree();
    expect(container.querySelector('.dimension-toggle')).toBeNull();
    expect(screen.getByText('Organize by:')).toBeInTheDocument();
    expect(container.querySelector('.dimension-selectors')).not.toHaveClass(
      'collapsed'
    );
  });

  it('collapses the selectors behind a breadcrumb toggle on phones', async () => {
    stubMatchMedia(true);
    const { container } = renderTree('Ordna efter');

    const toggle = container.querySelector(
      '.dimension-toggle'
    ) as HTMLButtonElement;
    const selectors = container.querySelector(
      '.dimension-selectors'
    ) as HTMLElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveTextContent('Ordna efter:');
    expect(
      Array.from(container.querySelectorAll('.dimension-crumb')).map(
        (crumb) => crumb.textContent
      )
    ).toEqual(['Location', 'Campaign']);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', selectors.id);
    expect(selectors).toHaveClass('collapsed');

    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(selectors).not.toHaveClass('collapsed');
    expect(container.querySelector('.dimension-bar')).toHaveClass('open');

    await fireEvent.click(toggle);
    expect(selectors).toHaveClass('collapsed');
  });
});
