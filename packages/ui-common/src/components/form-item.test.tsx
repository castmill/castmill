import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { FormItem } from './form-item'; // Adjust import path if needed

describe('FormItem Component', () => {
  afterEach(() => cleanup()); // Clean up after each test

  it('renders correctly with a label and an input', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <FormItem
        label="Email"
        id="email"
        name="emailValue"
        onInput={mockOnInput}
        placeholder="Enter your email"
        type="email"
      />
    ));
    const label = screen.getByText('Email');
    const input = screen.getByPlaceholderText('Enter your email');

    expect(label).toBeInTheDocument();
    expect(input).toBeInTheDocument();
    expect(label.htmlFor).toBe('email');
    expect(input.id).toBe('email');
  });

  it('handles input correctly', () => {
    const mockOnInput = vi.fn();
    render(() => (
      <FormItem
        label="Email"
        id="email"
        name="emailValue"
        onInput={mockOnInput}
        placeholder="Enter your email"
        type="email"
      />
    ));
    const input = screen.getByPlaceholderText('Enter your email');
    fireEvent.input(input, { target: { value: 'test@example.com' } });
    expect(mockOnInput).toHaveBeenCalledWith('test@example.com');
  });

  it('renders additional children if provided', () => {
    const mockOnInput = vi.fn();
    const ChildComponent = () => <span>Additional info</span>;
    render(() => (
      <FormItem
        label="Username"
        id="username"
        name="usernameValue"
        onInput={mockOnInput}
      >
        <ChildComponent />
      </FormItem>
    ));
    const additionalInfo = screen.getByText('Additional info');
    expect(additionalInfo).toBeInTheDocument();
  });
});
