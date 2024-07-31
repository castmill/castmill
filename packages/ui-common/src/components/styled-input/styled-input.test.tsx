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
});
