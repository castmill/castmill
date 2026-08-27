import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';

import { IconButton } from './icon-button'; // Ensure correct import path

describe('IconButton Component', () => {
  afterEach(() => cleanup()); // Clean up after each test

  it('renders correctly with an icon and default props', () => {
    const FakeIcon = () => <div>Icon</div>;
    render(() => <IconButton icon={FakeIcon} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('icon-button-primary');
    expect(button).not.toBeDisabled();
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });

  it('renders with custom color and disabled state', () => {
    const FakeIcon = () => <div>Icon</div>;
    render(() => <IconButton icon={FakeIcon} color="danger" disabled={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('icon-button-danger');
    expect(button).toHaveClass('icon-button-disabled');
    expect(button).toBeDisabled();
  });

  it('handles click event correctly', async () => {
    const mockOnClick = vi.fn();
    const FakeIcon = () => <div>Icon</div>;
    render(() => <IconButton icon={FakeIcon} onClick={mockOnClick} />);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const mockOnClick = vi.fn();
    const FakeIcon = () => <div>Icon</div>;
    render(() => (
      <IconButton icon={FakeIcon} onClick={mockOnClick} disabled={true} />
    ));
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(0);
  });

  it('applies the correct class based on the color prop', () => {
    const FakeIcon = () => <div>Icon</div>;
    render(() => <IconButton icon={FakeIcon} color="success" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('icon-button-success');
  });
});
