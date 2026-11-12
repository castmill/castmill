/** @jsxImportSource solid-js */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';

import { StyledInput } from './styled-input'; // Ensure correct import path

describe('StyledInput Component', () => {
  afterEach(() => cleanup()); // Clean up after each test

  it('renders correctly with default props', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <StyledInput id="test-input" value="" onInput={mockOnInput} />
    ));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('id', 'test-input');
    expect(input.value).toBe('');
  });

  it('updates on user input', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <StyledInput id="test-input" value="Hello" onInput={mockOnInput} />
    ));
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'Hello World' } });
    expect(mockOnInput).toHaveBeenCalledWith('Hello World');
  });

  it('is disabled when the disabled prop is true', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <StyledInput
        id="test-input"
        value="Hello"
        onInput={mockOnInput}
        disabled={true}
      />
    ));
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('renders with the specified placeholder and type', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <StyledInput
        id="test-input"
        type="email"
        placeholder="Enter your email"
        value=""
        onInput={mockOnInput}
      />
    ));
    const input = screen.getByPlaceholderText('Enter your email');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('renders a serialized false boolean value as unchecked', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <StyledInput
        id="test-input"
        type="boolean"
        value="false"
        onInput={mockOnInput}
      />
    ));

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('renders a serialized true boolean value as checked', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <StyledInput
        id="test-input"
        type="boolean"
        value="true"
        onInput={mockOnInput}
      />
    ));

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders and updates a multiline input', () => {
    const onInput = vi.fn();
    render(() => (
      <StyledInput
        id="notes"
        type="textarea"
        value="one"
        rows={3}
        placeholder="Notes"
        onInput={onInput}
      />
    ));

    const input = screen.getByPlaceholderText('Notes') as HTMLTextAreaElement;
    expect(input.tagName).toBe('TEXTAREA');
    expect(input.rows).toBe(3);
    fireEvent.input(input, { target: { value: 'one\ntwo' } });
    expect(onInput).toHaveBeenCalledWith('one\ntwo');
  });

  it('preserves numeric input as text when requested and keeps the default numeric behavior', () => {
    const rawInput = vi.fn();
    const numericInput = vi.fn();
    render(() => (
      <>
        <StyledInput
          id="raw"
          type="number"
          value=""
          step="any"
          parseNumber={false}
          onInput={rawInput}
        />
        <StyledInput
          id="number"
          type="number"
          value={0}
          onInput={numericInput}
        />
      </>
    ));

    const [raw, number] = screen.getAllByRole('spinbutton');
    expect(raw).toHaveAttribute('step', 'any');
    fireEvent.input(raw, { target: { value: '2.5' } });
    expect(rawInput).toHaveBeenCalledWith('2.5');
    fireEvent.input(raw, { target: { value: '' } });
    expect(rawInput).toHaveBeenCalledWith('');
    fireEvent.input(number, { target: { value: '2.5' } });
    expect(numericInput).toHaveBeenCalledWith(2.5);
  });
});
