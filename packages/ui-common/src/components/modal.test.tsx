import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';

import { Modal } from './modal';

describe('Modal Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.runAllTimers(); // Ensure all timers are flushed to avoid state leaks
  });

  it('renders correctly with title and description', () => {
    render(() => (
      <Modal
        title="Test Modal"
        description="This is a test"
        onClose={() => {}}
      />
    ));
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('This is a test')).toBeInTheDocument();
  });

  /*
  it('closes on overlay click', () => {
    const mockOnClose = vi.fn();
    render(() => <Modal title="Test Modal" onClose={mockOnClose} />);
    const overlay = screen.getByText(/Test Modal/).parentNode.parentNode; // Adjust as necessary based on your markup
    fireEvent.click(overlay);
    vi.runAllTimers();
    expect(mockOnClose).toHaveBeenCalled();
  });
  */

  it('closes on overlay click', () => {
    const mockOnClose = vi.fn();
    render(() => <Modal title="Test Modal" onClose={mockOnClose} />);

    // Directly selecting the overlay based on a more stable identifier
    const overlay = screen.getByTestId('modal-overlay'); // You need to add data-testid="modal-overlay" to your overlay div in the JSX
    fireEvent.click(overlay);

    vi.runAllTimers();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes on ESC key press', () => {
    const mockOnClose = vi.fn();
    render(() => <Modal title="Test Modal" onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    vi.runAllTimers();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('automatically closes after delay when success message is shown', () => {
    const mockOnClose = vi.fn();
    render(() => (
      <Modal
        title="Success"
        onClose={mockOnClose}
        successMessage="Success!"
        autoCloseDelay={5000}
      />
    ));
    vi.advanceTimersByTime(5000);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows retry button when error and showRetryButton props are true', () => {
    render(() => (
      <Modal
        title="Error"
        onClose={() => {}}
        errorMessage="Failed!"
        showRetryButton={true}
      />
    ));
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});
