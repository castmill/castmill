/** @jsxImportSource solid-js */
import styles from './switch.module.scss';

export const Switch = (props: {
  name: string;
  key: string;
  isActive: boolean;
  disabled: boolean;
  onToggle: (key: string) => void;
}) => {
  return (
    <label class={styles.filterLabel}>
      {props.name}
      <label class={styles.switch}>
        <input
          type="checkbox"
          checked={props.isActive}
          disabled={props.disabled}
          onChange={() => !props.disabled && props.onToggle(props.key)}
        />
        <span class={styles.slider}></span>
      </label>
    </label>
  );
};
