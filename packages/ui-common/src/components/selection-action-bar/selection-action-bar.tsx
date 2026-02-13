/** @jsxImportSource solid-js */

/**
 * SelectionActionBar
 *
 * A floating contextual bar that appears at the bottom of a container
 * when items are selected. Displays selection count and bulk action buttons.
 *
 * Inspired by the selection patterns in Gmail, Google Drive, and Notion.
 */
import { Component, JSX, Show } from 'solid-js';
import { IoCloseCircleOutline } from 'solid-icons/io';
import { BiRegularSelectMultiple } from 'solid-icons/bi';
import { IconWrapper } from '../icon-wrapper';
import './selection-action-bar.scss';

export interface SelectionActionBarProps {
  /** Number of selected items */
  count: number;

  /** Callback to clear / deselect all */
  onDeselectAll: () => void;

  /** Label template — use {count} as placeholder. Default: "{count} selected" */
  label?: string;

  /** Hint message shown when no items are selected. If provided, the bar stays
   *  visible in a muted state to guide the user. */
  hintMessage?: string;

  /** The action buttons to render (e.g. delete, export, move) */
  children?: JSX.Element;
}

export const SelectionActionBar: Component<SelectionActionBarProps> = (
  props
) => {
  const label = () => {
    const template = props.label || '{count} selected';
    return template.replace('{count}', String(props.count));
  };

  const isActive = () => props.count > 0;
  const showHint = () => !isActive() && !!props.hintMessage;

  return (
    <div
      class="castmill-selection-bar"
      classList={{ visible: isActive(), hint: showHint() }}
      role="toolbar"
      aria-label={isActive() ? 'Bulk actions' : 'Selection hint'}
    >
      <div class="selection-bar-inner">
        <Show
          when={isActive()}
          fallback={
            <div class="selection-hint">
              <IconWrapper icon={BiRegularSelectMultiple} />
              <span>{props.hintMessage}</span>
            </div>
          }
        >
          <div class="selection-info">
            <button
              class="deselect-btn"
              onClick={props.onDeselectAll}
              title="Clear selection"
              aria-label="Clear selection"
            >
              <IconWrapper icon={IoCloseCircleOutline} />
            </button>
            <span class="selection-count">{label()}</span>
          </div>

          <div class="selection-actions">{props.children}</div>
        </Show>
      </div>
    </div>
  );
};
