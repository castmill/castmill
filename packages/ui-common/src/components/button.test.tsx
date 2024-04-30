import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Button } from './button';

describe('Button Component', () => {
  afterEach(cleanup); // Clean up after each test

  it('renders correctly with default props', () => {
    const { getByRole } = render(() => <Button label="Click me" />);
    const button = getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('button-primary');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toBeDisabled();
  });

  it('renders with custom type and disabled state', () => {
    const { getByRole } = render(() => (
      <Button type="submit" disabled={true} />
    ));
    const button = getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
  });

  it('handles click event correctly', async () => {
    const mockOnClick = vi.fn();
    const { getByRole } = render(() => <Button onClick={mockOnClick} />);
    const button = getByRole('button');
    await fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const mockOnClick = vi.fn();
    const { getByRole } = render(() => (
      <Button onClick={mockOnClick} disabled={true} />
    ));
    const button = getByRole('button');
    await fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(0);
  });

  it('displays an icon when provided', () => {
    const Icon = () => <svg />;
    const { container } = render(() => <Button icon={Icon} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies the correct class based on the color prop', () => {
    const { getByRole } = render(() => <Button color="danger" />);
    const button = getByRole('button');
    expect(button).toHaveClass('button-danger');
  });
});
