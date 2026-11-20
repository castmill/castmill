/** @jsxImportSource solid-js */
import { Component, For, Show } from 'solid-js';
import { BsTagFill } from 'solid-icons/bs';
import type { Tag } from '../../services/tags.service';
import { TagBadge } from './tag-badge';
import styles from './tags-cell.module.scss';

export interface TagsCellProps {
  tags: Tag[];
  manageLabel: string;
  onManage: (anchorEl: HTMLElement) => void;
  manageButtonProps?: { 'data-onboarding'?: string };
}

export const TagsCell: Component<TagsCellProps> = (props) => (
  <div class={styles.cell}>
    <For each={props.tags.slice(0, 3)}>
      {(tag) => <TagBadge tag={tag} size="small" />}
    </For>
    <Show when={props.tags.length > 3}>
      <span class={styles.overflow}>+{props.tags.length - 3}</span>
    </Show>
    <button
      {...props.manageButtonProps}
      type="button"
      class={styles.manage}
      title={props.manageLabel}
      aria-label={props.manageLabel}
      onClick={(event) => {
        event.stopPropagation();
        props.onManage(event.currentTarget);
      }}
    >
      <BsTagFill aria-hidden="true" />
    </button>
  </div>
);
