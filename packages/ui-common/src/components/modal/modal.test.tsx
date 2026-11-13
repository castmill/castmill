import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { Modal } from './modal';
import { Drawer } from '../drawer/drawer';

describe('Modal Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    // Remove any remaining modal overlays from the body
    const overlays = document.body.querySelectorAll(
      '[data-testid="modal-overlay"]'
    );
    overlays.forEach((overlay) => overlay.remove());
    vi.restoreAllMocks();
    vi.runAllTimers(); // Ensure all timers are flushed
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

  it('labels the close button and can be vetoed by onCloseRequest', () => {
    const onClose = vi.fn();
    let allow = false;
    let modalRef: { close: () => Promise<void> } | undefined;
    render(() => (
      <Modal
        title="Edit"
        description=""
        closeLabel="Close editor"
        onClose={onClose}
        onCloseRequest={() => allow}
        ref={(r) => (modalRef = r)}
      />
    ));

    fireEvent.click(screen.getByTitle('Close editor'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('modal-overlay'));
    vi.runAllTimers();
    expect(onClose).not.toHaveBeenCalled();

    // Programmatic closes skip the guard.
    modalRef!.close();
    vi.runAllTimers();
    expect(onClose).toHaveBeenCalledTimes(1);
    allow = true;
  });

  it('renders a leading back button for the back variant', () => {
    const onClose = vi.fn();
    render(() => (
      <Modal
        title="Edit"
        description=""
        closeLabel="Back"
        closeVariant="back"
        onClose={onClose}
      />
    ));

    const back = screen.getByTitle('Back');
    const header = back.closest('[class*="modalHeader"]')!;
    expect(header.firstElementChild!.contains(back)).toBe(true);
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(back);
    vi.runAllTimers();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes before its containing drawer on consecutive Escape presses', () => {
    const onDrawerClose = vi.fn();
    const onModalClose = vi.fn();

    const NestedOverlays = () => {
      const [showModal, setShowModal] = createSignal(true);

      return (
        <Drawer title="Device" onClose={onDrawerClose}>
          <Show when={showModal()}>
            <Modal
              title="Error details"
              onClose={() => {
                setShowModal(false);
                onModalClose();
              }}
            />
          </Show>
        </Drawer>
      );
    };

    render(() => <NestedOverlays />);

    fireEvent.keyDown(document, { key: 'Escape' });
    vi.runAllTimers();

    expect(onModalClose).toHaveBeenCalledOnce();
    expect(onDrawerClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    vi.runAllTimers();

    expect(onDrawerClose).toHaveBeenCalledOnce();
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

  it('scrolls only the body, without clipping wrappers around the content', () => {
    render(() => (
      <Modal title="Form" description="" onClose={() => {}}>
        <form>
          <input aria-label="Name" />
          <div data-modal-actions>
            <button type="submit">Save</button>
          </div>
        </form>
      </Modal>
    ));

    const content = screen.getByTestId('modal-overlay').firstElementChild!;
    const [header, body] = Array.from(content.children) as HTMLElement[];
    expect(header.className).toContain('modalHeader');
    expect(body.className).toContain('modalBody');

    // Sticky action rows need the body to be their nearest scroll container,
    // so nothing between the body and the content may clip or scroll.
    let el: HTMLElement | null = screen.getByText('Save').parentElement!;
    expect(el.hasAttribute('data-modal-actions')).toBe(true);
    while (el && el !== body) {
      expect(el.style.overflow).toBe('');
      el = el.parentElement;
    }
    expect(el).toBe(body);
    const inner = body.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.display).toBe('flow-root');
  });

  it('pins the overlay to the visual viewport for on-screen keyboards', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    class FakeVisualViewport extends EventTarget {
      width = 375;
      height = 400;
      offsetLeft = 0;
      offsetTop = 0;
    }
    const vv = new FakeVisualViewport();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    try {
      render(() => <Modal title="Form" description="" onClose={() => {}} />);
      const overlay = screen.getByTestId('modal-overlay');
      expect(overlay.style.height).toBe('400px');
      expect(overlay.style.width).toBe('375px');

      // The keyboard closes: the overlay follows the visual viewport.
      vv.height = 700;
      vv.dispatchEvent(new Event('resize'));
      expect(overlay.style.height).toBe('700px');
    } finally {
      if (original) Object.defineProperty(window, 'visualViewport', original);
      else delete (window as { visualViewport?: unknown }).visualViewport;
    }
  });
});

describe('Modal responsive styles', () => {
  const css = readFileSync(
    resolve('src/components/modal/modal.module.scss'),
    'utf8'
  );
  const block = (start: string) => {
    const index = css.indexOf(start);
    expect(index).toBeGreaterThanOrEqual(0);
    return css.slice(index, css.indexOf('\n}\n', index));
  };

  it('keeps every modal inside the viewport with a scrolling body', () => {
    expect(block(':where(.modalContent) {')).toMatch(
      /max-width: calc\(100% - 2em\);\s*max-height: calc\(100% - 2em\);/
    );
    expect(css).toMatch(
      /\.modalBody \{[^}]*flex: 1 1 auto;\s*min-height: 0;\s*overflow-y: auto;/
    );
    expect(css).not.toContain('!important');
  });

  it('becomes a full-width bottom sheet on phones', () => {
    const sheet = block(
      '@media (max-width: 36em), (pointer: coarse) and (max-height: 32em) {'
    );
    expect(sheet).toContain('align-items: flex-end;');
    expect(sheet).toMatch(/width: 100%;\s*min-width: 0;\s*max-width: 100%;/);
    expect(sheet).toContain('env(safe-area-inset-bottom)');
    expect(sheet).toContain('border-radius: 0.75em 0.75em 0 0;');
    expect(sheet).not.toMatch(/\d+px/);
  });

  it('sticks full-width action rows to the bottom on phones', () => {
    const actions = block(
      '@media (max-width: 36em) {\n  .modalOverlay .modalContent .modalBody'
    );
    expect(actions).toContain(':global([data-modal-actions])');
    expect(actions).toMatch(/position: sticky;\s*bottom: 0;/);
    expect(actions).toContain('background-color: var(--cm-bg-elevated);');
    expect(actions).toMatch(/> \* \{\s*flex: 1 1 0;/);
  });
});
