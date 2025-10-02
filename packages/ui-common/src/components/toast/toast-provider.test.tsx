import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup, screen } from '@solidjs/testing-library';
import { ToastProvider, useToast } from './toast-provider';
import { Component, createSignal } from 'solid-js';

describe('ToastProvider and useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it('provides toast context to children', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return <div>{toast ? 'Context available' : 'No context'}</div>;
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    expect(screen.getByText('Context available')).toBeInTheDocument();
  });

  it('throws error when useToast is used outside ToastProvider', () => {
    const TestComponent: Component = () => {
      try {
        useToast();
        return <div>Should not reach here</div>;
      } catch (error) {
        return <div>Error caught</div>;
      }
    };

    render(() => <TestComponent />);
    expect(screen.getByText('Error caught')).toBeInTheDocument();
  });

  it('shows toast when showToast is called', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return (
        <button onClick={() => toast.showToast('Test message', 'info')}>
          Show Toast
        </button>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Toast');
    button.click();

    // Advance timers to trigger toast visibility
    vi.advanceTimersByTime(20);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('shows success toast', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return (
        <button onClick={() => toast.success('Success message')}>
          Show Success
        </button>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Success');
    button.click();

    vi.advanceTimersByTime(20);

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('shows error toast', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return (
        <button onClick={() => toast.error('Error message')}>
          Show Error
        </button>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Error');
    button.click();

    vi.advanceTimersByTime(20);

    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('shows warning toast', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return (
        <button onClick={() => toast.warning('Warning message')}>
          Show Warning
        </button>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Warning');
    button.click();

    vi.advanceTimersByTime(20);

    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('shows info toast', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return (
        <button onClick={() => toast.info('Info message')}>Show Info</button>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Info');
    button.click();

    vi.advanceTimersByTime(20);

    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('removes toast when removeToast is called', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      const [toastId, setToastId] = createSignal<string | null>(null);

      return (
        <>
          <button
            onClick={() => {
              const id = toast.success('Test toast');
              setToastId(id);
            }}
          >
            Show Toast
          </button>
          <button
            onClick={() => {
              if (toastId()) {
                toast.removeToast(toastId()!);
              }
            }}
          >
            Remove Toast
          </button>
        </>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    // Show toast
    const showButton = screen.getByText('Show Toast');
    showButton.click();

    vi.advanceTimersByTime(20);
    expect(screen.getByText('Test toast')).toBeInTheDocument();

    // Remove toast
    const removeButton = screen.getByText('Remove Toast');
    removeButton.click();

    expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
  });

  it('handles multiple toasts', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast.success('First toast');
            toast.error('Second toast');
            toast.info('Third toast');
          }}
        >
          Show Multiple Toasts
        </button>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Multiple Toasts');
    button.click();

    vi.advanceTimersByTime(20);

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('returns unique IDs for each toast', () => {
    const TestComponent: Component = () => {
      const toast = useToast();
      const [ids, setIds] = createSignal<string[]>([]);

      return (
        <>
          <button
            onClick={() => {
              const id1 = toast.success('Toast 1');
              const id2 = toast.success('Toast 2');
              setIds([id1, id2]);
            }}
          >
            Show Toasts
          </button>
          <div data-testid="ids">{ids().join(',')}</div>
        </>
      );
    };

    render(() => (
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    ));

    const button = screen.getByText('Show Toasts');
    button.click();

    const idsElement = screen.getByTestId('ids');
    const idsText = idsElement.textContent || '';
    const idArray = idsText.split(',').filter((id) => id);

    expect(idArray.length).toBe(2);
    expect(idArray[0]).not.toBe(idArray[1]);
    expect(idArray[0]).toContain('toast-');
    expect(idArray[1]).toContain('toast-');
  });
});
