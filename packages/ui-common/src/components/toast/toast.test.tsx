import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { Toast } from './toast';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it('renders correctly with message', () => {
    render(() => <Toast id="test-1" message="Test notification" type="info" />);
    expect(screen.getByText('Test notification')).toBeInTheDocument();
  });

  it('renders with success type', () => {
    render(() => (
      <Toast id="test-2" message="Success message" type="success" />
    ));
    const toast = screen.getByTestId('toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders with error type', () => {
    render(() => <Toast id="test-3" message="Error message" type="error" />);
    const toast = screen.getByTestId('toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('renders with warning type', () => {
    render(() => (
      <Toast id="test-4" message="Warning message" type="warning" />
    ));
    const toast = screen.getByTestId('toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('renders with info type (default)', () => {
    render(() => <Toast id="test-5" message="Info message" />);
    const toast = screen.getByTestId('toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    render(() => (
      <Toast id="test-6" message="Test" type="info" onClose={mockOnClose} />
    ));

    const closeButton = screen.getByTestId('toast-close-button');
    fireEvent.click(closeButton);

    // Wait for the exit animation
    vi.advanceTimersByTime(300);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes after specified duration', () => {
    const mockOnClose = vi.fn();
    render(() => (
      <Toast
        id="test-7"
        message="Test"
        type="info"
        duration={3000}
        onClose={mockOnClose}
      />
    ));

    // Fast-forward time by the duration
    vi.advanceTimersByTime(3000);

    // Wait for the exit animation
    vi.advanceTimersByTime(300);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close when duration is 0', () => {
    const mockOnClose = vi.fn();
    render(() => (
      <Toast
        id="test-8"
        message="Test"
        type="info"
        duration={0}
        onClose={mockOnClose}
      />
    ));

    // Fast-forward time
    vi.advanceTimersByTime(10000);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('applies visible class after mount', () => {
    render(() => <Toast id="test-9" message="Test" type="info" />);

    // Advance timers to trigger the visible state
    vi.advanceTimersByTime(20);

    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('visible');
  });

  it('cleans up timers on unmount', () => {
    const mockOnClose = vi.fn();
    const { unmount } = render(() => (
      <Toast
        id="test-10"
        message="Test"
        type="info"
        duration={5000}
        onClose={mockOnClose}
      />
    ));

    // Unmount before duration completes
    unmount();
    vi.advanceTimersByTime(5000);

    // onClose should not be called since component was unmounted
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
