/** @jsxImportSource solid-js */

import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { TagBadge } from './tag-badge';
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

describe('TagBadge', () => {
  afterEach(cleanup);

  it('renders the tag name', () => {
    const tag = createTag({ name: 'London' });
    const { getByText } = render(() => <TagBadge tag={tag} />);
    expect(getByText('London')).toBeInTheDocument();
  });

  it('renders with default medium size class', () => {
    const tag = createTag();
    const { container } = render(() => <TagBadge tag={tag} />);
    const badge = container.querySelector('.castmill-tag-badge');
    expect(badge).toHaveClass('medium');
  });

  it('applies the specified size class', () => {
    const tag = createTag();
    const { container } = render(() => <TagBadge tag={tag} size="small" />);
    const badge = container.querySelector('.castmill-tag-badge');
    expect(badge).toHaveClass('small');
  });

  it('applies selected class when selected', () => {
    const tag = createTag();
    const { container } = render(() => <TagBadge tag={tag} selected={true} />);
    const badge = container.querySelector('.castmill-tag-badge');
    expect(badge).toHaveClass('selected');
  });

  it('sets tag color as CSS custom property', () => {
    const tag = createTag({ color: '#EF4444' });
    const { container } = render(() => <TagBadge tag={tag} />);
    const badge = container.querySelector('.castmill-tag-badge') as HTMLElement;
    expect(badge.style.getPropertyValue('--tag-color')).toBe('#EF4444');
  });

  it('calculates white text for dark backgrounds', () => {
    const tag = createTag({ color: '#000000' });
    const { container } = render(() => <TagBadge tag={tag} />);
    const badge = container.querySelector('.castmill-tag-badge') as HTMLElement;
    expect(badge.style.getPropertyValue('--tag-text-color')).toBe('#ffffff');
  });

  it('calculates black text for light backgrounds', () => {
    const tag = createTag({ color: '#FFFFFF' });
    const { container } = render(() => <TagBadge tag={tag} />);
    const badge = container.querySelector('.castmill-tag-badge') as HTMLElement;
    expect(badge.style.getPropertyValue('--tag-text-color')).toBe('#000000');
  });

  it('renders the color dot', () => {
    const tag = createTag();
    const { container } = render(() => <TagBadge tag={tag} />);
    expect(container.querySelector('.tag-dot')).toBeInTheDocument();
  });

  describe('click handling', () => {
    it('calls onClick when clicked', async () => {
      const tag = createTag();
      const onClick = vi.fn();
      const { container } = render(() => (
        <TagBadge tag={tag} onClick={onClick} />
      ));
      const badge = container.querySelector('.castmill-tag-badge')!;
      await fireEvent.click(badge);
      expect(onClick).toHaveBeenCalledWith(tag);
    });

    it('has role="button" when onClick is set', () => {
      const tag = createTag();
      const { container } = render(() => (
        <TagBadge tag={tag} onClick={() => {}} />
      ));
      const badge = container.querySelector('.castmill-tag-badge');
      expect(badge).toHaveAttribute('role', 'button');
    });

    it('has no role when onClick is not set', () => {
      const tag = createTag();
      const { container } = render(() => <TagBadge tag={tag} />);
      const badge = container.querySelector('.castmill-tag-badge');
      expect(badge).not.toHaveAttribute('role');
    });

    it('does not call onClick when disabled', async () => {
      const tag = createTag();
      const onClick = vi.fn();
      const { container } = render(() => (
        <TagBadge tag={tag} onClick={onClick} disabled={true} />
      ));
      const badge = container.querySelector('.castmill-tag-badge')!;
      await fireEvent.click(badge);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('applies disabled class when disabled', () => {
      const tag = createTag();
      const { container } = render(() => (
        <TagBadge tag={tag} disabled={true} />
      ));
      const badge = container.querySelector('.castmill-tag-badge');
      expect(badge).toHaveClass('disabled');
    });
  });

  describe('remove button', () => {
    it('does not render remove button by default', () => {
      const tag = createTag();
      const { container } = render(() => <TagBadge tag={tag} />);
      expect(container.querySelector('.tag-remove')).not.toBeInTheDocument();
    });

    it('renders remove button when removable and onRemove provided', () => {
      const tag = createTag();
      const { container } = render(() => (
        <TagBadge tag={tag} removable={true} onRemove={() => {}} />
      ));
      expect(container.querySelector('.tag-remove')).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', async () => {
      const tag = createTag();
      const onRemove = vi.fn();
      const { container } = render(() => (
        <TagBadge tag={tag} removable={true} onRemove={onRemove} />
      ));
      const removeBtn = container.querySelector('.tag-remove')!;
      await fireEvent.click(removeBtn);
      expect(onRemove).toHaveBeenCalledWith(tag);
    });

    it('has accessibility label on remove button', () => {
      const tag = createTag({ name: 'MyTag' });
      const { container } = render(() => (
        <TagBadge tag={tag} removable={true} onRemove={() => {}} />
      ));
      const removeBtn = container.querySelector('.tag-remove');
      expect(removeBtn).toHaveAttribute('aria-label', 'Remove tag MyTag');
    });

    it('does not call onRemove when disabled', async () => {
      const tag = createTag();
      const onRemove = vi.fn();
      const { container } = render(() => (
        <TagBadge
          tag={tag}
          removable={true}
          onRemove={onRemove}
          disabled={true}
        />
      ));
      const removeBtn = container.querySelector('.tag-remove')!;
      await fireEvent.click(removeBtn);
      expect(onRemove).not.toHaveBeenCalled();
    });
  });

  describe('keyboard interaction', () => {
    it('triggers onClick on Enter key', async () => {
      const tag = createTag();
      const onClick = vi.fn();
      const { container } = render(() => (
        <TagBadge tag={tag} onClick={onClick} />
      ));
      const badge = container.querySelector('.castmill-tag-badge')!;
      await fireEvent.keyDown(badge, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledWith(tag);
    });

    it('triggers onClick on Space key', async () => {
      const tag = createTag();
      const onClick = vi.fn();
      const { container } = render(() => (
        <TagBadge tag={tag} onClick={onClick} />
      ));
      const badge = container.querySelector('.castmill-tag-badge')!;
      await fireEvent.keyDown(badge, { key: ' ' });
      expect(onClick).toHaveBeenCalledWith(tag);
    });
  });
});
