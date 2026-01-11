import {
  Component,
  Switch,
  Match,
  onMount,
  createEffect,
  createSignal,
} from 'solid-js';
import styles from './styled-input.module.scss';

export const StyledInput: Component<{
  value: string | boolean | number;
  onInput: (value: string | boolean | number) => void;
  placeholder?: string;
  type?: string;
  id: string;
  disabled?: boolean;
  autofocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}> = (props) => {
  const [inputEl, setInputEl] = createSignal<HTMLInputElement | null>(null);

  onMount(() => {
    const el = inputEl();
    if (props.autofocus && el) {
      // Use setTimeout to ensure the modal/dialog animation is complete
      setTimeout(() => {
        el?.focus();
      }, 100);
    }
  });

  // Keep input value in sync with props.value (for controlled inputs)
  createEffect(() => {
    const el = inputEl();
    if (el && props.type !== 'boolean') {
      const newValue = String(props.value);
      if (el.value !== newValue) {
        el.value = newValue;
      }
    }
  });

  return (
    <Switch
      fallback={
        <input
          ref={setInputEl}
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
          ref={setInputEl}
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
          ref={setInputEl}
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
          ref={setInputEl}
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
      <Match when={props.type === 'color'}>
        <input
          ref={setInputEl}
          id={props.id}
          type="color"
          class={styles['input-color']}
          value={String(props.value || '#000000')}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          disabled={props.disabled}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
        />
      </Match>
      {/* Additional cases can be added here */}
    </Switch>
  );
};
