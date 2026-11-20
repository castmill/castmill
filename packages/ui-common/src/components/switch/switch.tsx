/** @jsxImportSource solid-js */
import styles from './switch.module.scss';

export const Switch = (props: {
  name: string;
  key: string;
  isActive: boolean;
  disabled: boolean;
  onToggle: (key: string) => void;
  /** Use `name` only as the accessible name (when the label is shown elsewhere). */
  hideLabel?: boolean;
}) => {
  return (
    <label class={styles.filterLabel}>
      {!props.hideLabel && props.name}
      <label class={styles.switch}>
        <input
          type="checkbox"
          aria-label={props.hideLabel ? props.name : undefined}
          checked={props.isActive}
          disabled={props.disabled}
          onChange={() => !props.disabled && props.onToggle(props.key)}
        />
        <span class={styles.slider}></span>
      </label>
    </label>
  );
};
