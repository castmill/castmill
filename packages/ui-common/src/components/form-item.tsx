import { Component, JSX } from 'solid-js';
import { StyledInput } from './styled-input';
import './form-item.scss';

interface FormItemProps {
  label: string;
  id: string;
  name: string;
  children: JSX.Element;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}

export const FormItem: Component<FormItemProps> = ({
  id,
  placeholder,
  label,
  name,
  type,
  children,
  onInput,
}) => {
  return (
    <div class="form-item">
      <label for={id}>{label}</label>
      <StyledInput
        id={id}
        value={name}
        type={type}
        onInput={onInput}
        placeholder={placeholder}
      />
      {children}
    </div>
  );
};
