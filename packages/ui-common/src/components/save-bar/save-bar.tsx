/** @jsxImportSource solid-js */

import { JSX, ParentComponent } from 'solid-js';

import styles from './save-bar.module.scss';

export interface SaveBarProps {
  /** Shows `dirtyLabel` while there are unsaved changes. */
  dirty?: boolean;
  /** Localized "unsaved changes" message. */
  dirtyLabel?: JSX.Element;
  class?: string;
  'data-testid'?: string;
}

/**
 * Action row for details forms (Reset/Save...): actions aligned to the end
 * with an "unsaved changes" status in front of them. On phones the buttons
 * share the full width and the status wraps above them.
 */
export const SaveBar: ParentComponent<SaveBarProps> = (props) => (
  <div
    class={props.class ? `${styles.saveBar} ${props.class}` : styles.saveBar}
    data-save-bar
    data-testid={props['data-testid']}
  >
    <span class={styles.dirty} aria-live="polite">
      {props.dirty ? props.dirtyLabel : ''}
    </span>
    {props.children}
  </div>
);
