import { Component, Switch, Match } from 'solid-js';
import styles from './styled-input.module.scss';

export const StyledInput: Component<{
  value: string | boolean | number;
  onInput: (value: string | boolean | number) => void;
  placeholder?: string;
  type?: string;
  id: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}> = (props) => {
  return (
    <Switch
      fallback={
        <input
          id={props.id}
          type="text"
          class={styles['input-text']}
          value={String(props.value)}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autocomplete="off"
        />
      }
    >
      <Match when={props.type === 'boolean'}>
        <input
          id={props.id}
          type="checkbox"
          class={styles['input-checkbox']}
          checked={Boolean(props.value)}
          onChange={(e) => props.onInput(e.currentTarget.checked)}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autocomplete="off"
        />
      </Match>
      <Match when={props.type === 'number'}>
        <input
          id={props.id}
          type="number"
          class={styles['input-number']}
          value={String(props.value)}
          onInput={(e) => props.onInput(Number(e.currentTarget.value))}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autocomplete="off"
        />
      </Match>
      <Match when={props.type === 'email'}>
        <input
          id={props.id}
          type="email"
          class={styles['input-email']}
          value={String(props.value)}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          placeholder={props.placeholder}
          disabled={props.disabled}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          autocomplete="off"
        />
      </Match>
      {/* Additional cases can be added here */}
    </Switch>
  );
};
