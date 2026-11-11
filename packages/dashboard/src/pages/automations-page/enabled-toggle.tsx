import { Component } from 'solid-js';
import styles from './automations.module.scss';

/** Accessible on/off switch. */
export const EnabledToggle: Component<{
  checked: boolean;
  label: string;
  disabled?: boolean;
  showLabel?: boolean;
  onChange: (checked: boolean) => void;
}> = (props) => (
  <button
    type="button"
    role="switch"
    class={styles.switch}
    classList={{ [styles.on]: props.checked }}
    aria-checked={props.checked}
    aria-label={props.showLabel ? undefined : props.label}
    title={props.label}
    disabled={props.disabled}
    onClick={(e) => {
      e.stopPropagation();
      props.onChange(!props.checked);
    }}
  >
    <span class={styles.switchTrack} aria-hidden="true">
      <span class={styles.switchThumb} />
    </span>
    {props.showLabel ? <span>{props.label}</span> : null}
  </button>
);
