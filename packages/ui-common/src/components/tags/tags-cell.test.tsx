/** @jsxImportSource solid-js */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { Tag } from '../../services/tags.service';
import { TagsCell } from './tags-cell';

const tag = (id: number): Tag => ({
  id,
  name: `Tag ${id}`,
  color: '#123456',
  position: id,
  organization_id: 'org',
  inserted_at: '',
  updated_at: '',
});

describe('TagsCell', () => {
  afterEach(cleanup);

  it('updates the displayed badges and overflow when tags change', () => {
    const [tags, setTags] = createSignal<Tag[]>([]);
    render(() => (
      <TagsCell tags={tags()} manageLabel="Manage tags" onManage={() => {}} />
    ));

    expect(screen.queryByText('+1')).not.toBeInTheDocument();
    setTags([tag(1), tag(2), tag(3), tag(4)]);
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 3')).toBeInTheDocument();
    expect(screen.queryByText('Tag 4')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    setTags([tag(4)]);
    expect(screen.getByText('Tag 4')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });

  it('opens management with the button anchor without activating the row', async () => {
    const onManage = vi.fn();
    const onRowClick = vi.fn();
    render(() => (
      <div onClick={onRowClick}>
        <TagsCell
          tags={[]}
          manageLabel="Manage tags"
          manageButtonProps={{ 'data-onboarding': 'tag-content' }}
          onManage={onManage}
        />
      </div>
    ));

    const button = screen.getByRole('button', { name: 'Manage tags' });
    expect(button).toHaveAttribute('data-onboarding', 'tag-content');
    await fireEvent.click(button);
    expect(onManage).toHaveBeenCalledWith(button);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
