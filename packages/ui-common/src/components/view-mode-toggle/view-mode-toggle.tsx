/**
 * ViewModeToggle
 *
 * A toggle button for switching between list (table) and tree view modes.
 */
import { Component } from 'solid-js';
import { BsListUl } from 'solid-icons/bs';
import { RiEditorOrganizationChart } from 'solid-icons/ri';
import { IconWrapper } from '../icon-wrapper';
import './view-mode-toggle.scss';

export type ViewMode = 'list' | 'tree';

export interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabled?: boolean;
  listLabel?: string;
  treeLabel?: string;
}

export const ViewModeToggle: Component<ViewModeToggleProps> = (props) => {
  return (
    <div
      class="castmill-view-mode-toggle"
      classList={{ disabled: props.disabled }}
    >
      <button
        type="button"
        class="toggle-btn"
        classList={{ active: props.mode === 'list' }}
        onClick={() => props.onChange('list')}
        disabled={props.disabled}
        title={props.listLabel || 'List view'}
        aria-label={props.listLabel || 'List view'}
      >
        <IconWrapper icon={BsListUl} />
      </button>
      <button
        type="button"
        class="toggle-btn"
        classList={{ active: props.mode === 'tree' }}
        onClick={() => props.onChange('tree')}
        disabled={props.disabled}
        title={props.treeLabel || 'Tree view'}
        aria-label={props.treeLabel || 'Tree view'}
      >
        <IconWrapper icon={RiEditorOrganizationChart} />
      </button>
    </div>
  );
};
