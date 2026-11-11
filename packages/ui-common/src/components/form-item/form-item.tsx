import { Component, JSX, Show, createSignal } from 'solid-js';
import { StyledInput } from '../styled-input/styled-input';
import './form-item.scss';

interface FormItemProps {
  label: string;
  id: string;
  value: string | number | boolean;
  children?: JSX.Element;
  onInput: (value: string | boolean | number) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  autofocus?: boolean;
  description?: string;
  rows?: number;
  step?: string | number;
  parseNumber?: boolean;
}

export const FormItem: Component<FormItemProps> = (props) => {
  const [isFocused, setIsFocused] = createSignal(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <div class="form-item-wrapper">
      <div class={`form-item1 ${isFocused() ? 'focused' : ''}`}>
        <label for={props.id}>{props.label}</label>
        <StyledInput
          id={props.id}
          value={props.value}
          type={props.type}
          onInput={props.onInput}
          placeholder={props.placeholder}
          autofocus={props.autofocus}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={props.disabled}
          rows={props.rows}
          step={props.step}
          parseNumber={props.parseNumber}
        />
        {props.children}
      </div>
      <Show when={props.description}>
        <div class="description">{props.description}</div>
      </Show>
    </div>
  );
};
