import { Component, JSX, Show, createSignal } from 'solid-js';
import { StyledInput } from '../styled-input/styled-input';
import './form-item.scss';

interface FormItemProps {
  label: string;
  id: string;
  value: string;
  children: JSX.Element;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  description?: string;
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={props.disabled}
        />
        {props.children}
      </div>
      <Show when={props.description}>
        <div class="description">{props.description}</div>
      </Show>
    </div>
  );
};
