/** @jsxImportSource solid-js */

/**
 * TagBadge Component
 *
 * A compact badge/pill component displaying a tag with its color and name.
 * Optionally includes a remove button for inline removal.
 */

import { Component, Show } from 'solid-js';
import { IoCloseCircle } from 'solid-icons/io';
import type { Tag } from '../../services/tags.service';

import './tag-badge.scss';

export interface TagBadgeProps {
  tag: Tag;
  size?: 'small' | 'medium' | 'large';
  removable?: boolean;
  onRemove?: (tag: Tag) => void;
  onClick?: (tag: Tag) => void;
  selected?: boolean;
  disabled?: boolean;
}

/**
 * Calculates contrasting text color (black or white) based on background color.
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export const TagBadge: Component<TagBadgeProps> = (props) => {
  const textColor = () => getContrastColor(props.tag.color);

  const handleClick = (e: MouseEvent) => {
    if (props.disabled) return;
    e.stopPropagation();
    props.onClick?.(props.tag);
  };

  const handleRemove = (e: MouseEvent) => {
    if (props.disabled) return;
    e.stopPropagation();
    props.onRemove?.(props.tag);
  };

  return (
    <span
      class={`castmill-tag-badge ${props.size || 'medium'} ${props.selected ? 'selected' : ''} ${props.onClick ? 'clickable' : ''} ${props.disabled ? 'disabled' : ''}`}
      style={{
        '--tag-color': props.tag.color,
        '--tag-text-color': textColor(),
      }}
      onClick={props.onClick ? handleClick : undefined}
      role={props.onClick ? 'button' : undefined}
      tabIndex={props.onClick && !props.disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (props.onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          props.onClick(props.tag);
        }
      }}
    >
      <span class="tag-dot" aria-hidden="true" />
      <span class="tag-name">{props.tag.name}</span>
      <Show when={props.removable && props.onRemove}>
        <button
          class="tag-remove"
          type="button"
          onClick={handleRemove}
          disabled={props.disabled}
          aria-label={`Remove tag ${props.tag.name}`}
        >
          <IoCloseCircle />
        </button>
      </Show>
    </span>
  );
};
