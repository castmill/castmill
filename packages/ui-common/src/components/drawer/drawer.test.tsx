/** @jsxImportSource solid-js */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { Drawer } from './drawer';

describe('Drawer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    const drawerRoots = document.querySelectorAll(
      '[data-testid="drawer-root"]'
    );
    drawerRoots.forEach((root) => root.remove());
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders correctly with title and description', () => {
    render(() => (
      <Drawer title="Device A" description="Drawer body" onClose={() => {}}>
        <div>Drawer content</div>
      </Drawer>
    ));

    expect(screen.getByText('Device A')).toBeInTheDocument();
    expect(screen.getByText('Drawer body')).toBeInTheDocument();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('renders the footer once, outside the scrolling body', () => {
    const footerRef = vi.fn();

    render(() => (
      <Drawer
        title="With footer"
        onClose={() => {}}
        footer={<button ref={footerRef}>Save</button>}
      >
        <div>Body</div>
      </Drawer>
    ));

    const save = screen.getByRole('button', { name: 'Save' });
    expect(footerRef).toHaveBeenCalledTimes(1);
    expect(footerRef.mock.calls[0][0]).toBe(save);
    expect(save.parentElement?.contains(screen.getByText('Body'))).toBe(false);
    expect(save.parentElement?.parentElement).toBe(screen.getByRole('dialog'));
  });

  it('omits the footer when none is given', () => {
    render(() => (
      <Drawer title="No footer" onClose={() => {}}>
        <div>Body</div>
      </Drawer>
    ));

    expect(screen.getByRole('dialog').children).toHaveLength(2);
  });

  it('closes on ESC key press', () => {
    const onClose = vi.fn();

    render(() => (
      <Drawer title="Closable" onClose={onClose}>
        <div />
      </Drawer>
    ));

    fireEvent.keyDown(document, { key: 'Escape' });
    vi.runAllTimers();

    expect(onClose).toHaveBeenCalled();
  });

  it('focuses the panel without scrolling it into view while it slides in', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');

    render(() => (
      <Drawer title="Sliding" onClose={() => {}}>
        <div />
      </Drawer>
    ));
    vi.runAllTimers();

    const panel = screen.getByRole('dialog');
    expect(panel.className).toContain('active');
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(focusSpy.mock.instances).toContain(panel);
  });

  it('removes drawer root from DOM after close animation', () => {
    render(() => (
      <Drawer title="Closable" onClose={() => {}}>
        <div />
      </Drawer>
    ));

    fireEvent.click(screen.getByTitle('Close'));
    vi.runAllTimers();

    expect(screen.queryByTestId('drawer-root')).not.toBeInTheDocument();
  });

  it('closes on overlay click when backdrop is enabled', () => {
    const onClose = vi.fn();

    render(() => (
      <Drawer title="Overlay" onClose={onClose} showBackdrop={true}>
        <div />
      </Drawer>
    ));

    fireEvent.click(screen.getByTestId('drawer-root'));
    vi.runAllTimers();

    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on overlay click when backdrop is disabled', () => {
    const onClose = vi.fn();

    render(() => (
      <Drawer title="No overlay close" onClose={onClose} showBackdrop={false}>
        <div />
      </Drawer>
    ));

    fireEvent.click(screen.getByTestId('drawer-root'));
    vi.runAllTimers();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('computes auto backdrop mode from viewport width', () => {
    const originalWidth = window.innerWidth;

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 900,
    });

    render(() => (
      <Drawer
        title="Auto backdrop"
        onClose={() => {}}
        showBackdrop="auto"
        autoBackdropBreakpoint={1200}
      >
        <div />
      </Drawer>
    ));

    expect(screen.getByTestId('drawer-root')).toHaveAttribute(
      'data-has-backdrop',
      'true'
    );

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    });

    fireEvent(window, new Event('resize'));

    expect(screen.getByTestId('drawer-root')).toHaveAttribute(
      'data-has-backdrop',
      'false'
    );

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalWidth,
    });
  });

  it('does not close on outside click when click is inside a modal overlay', () => {
    const onClose = vi.fn();

    // Create a modal overlay element in the document body
    const modalOverlay = document.createElement('div');
    modalOverlay.setAttribute('data-modal-overlay', '');
    const modalContent = document.createElement('div');
    modalContent.textContent = 'Modal content';
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    render(() => (
      <Drawer
        title="Drawer with modal"
        onClose={onClose}
        showBackdrop={false}
        closeOnOutsideClick
      >
        <div>Drawer content</div>
      </Drawer>
    ));

    vi.runAllTimers();

    // Click inside the modal overlay — drawer should NOT close
    fireEvent.click(modalContent);
    vi.runAllTimers();

    expect(onClose).not.toHaveBeenCalled();

    // Clean up the modal overlay
    modalOverlay.remove();
  });

  it('does not close on outside click inside a combobox sheet', () => {
    const onClose = vi.fn();

    // Create a modal overlay element in the document body
    const modalOverlay = document.createElement('div');
    modalOverlay.setAttribute('data-combobox-sheet', '');
    const modalContent = document.createElement('div');
    modalContent.textContent = 'Modal content';
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    render(() => (
      <Drawer
        title="Drawer with modal"
        onClose={onClose}
        showBackdrop={false}
        closeOnOutsideClick
      >
        <div>Drawer content</div>
      </Drawer>
    ));

    vi.runAllTimers();

    // Click inside the modal overlay — drawer should NOT close
    fireEvent.click(modalContent);
    vi.runAllTimers();

    expect(onClose).not.toHaveBeenCalled();

    // Clean up the modal overlay
    modalOverlay.remove();
  });
  it('does not close when clicking inside a drawer from another stack', () => {
    const onClose = vi.fn();

    const otherDrawerPanel = document.createElement('div');
    otherDrawerPanel.setAttribute('data-drawer-panel', '');
    const otherDrawerContent = document.createElement('button');
    otherDrawerContent.textContent = 'Other drawer action';
    otherDrawerPanel.appendChild(otherDrawerContent);
    document.body.appendChild(otherDrawerPanel);

    render(() => (
      <Drawer
        title="Parent drawer"
        onClose={onClose}
        showBackdrop={false}
        closeOnOutsideClick
      >
        <div>Parent drawer content</div>
      </Drawer>
    ));

    vi.runAllTimers();
    fireEvent.click(otherDrawerContent);
    vi.runAllTimers();

    expect(onClose).not.toHaveBeenCalled();

    otherDrawerPanel.remove();
  });

  it('closes on outside click when click is not inside a modal overlay', () => {
    const onClose = vi.fn();

    // Create a regular element outside the drawer (not a modal)
    const outsideElement = document.createElement('div');
    outsideElement.textContent = 'Outside';
    document.body.appendChild(outsideElement);

    render(() => (
      <Drawer
        title="Drawer without modal"
        onClose={onClose}
        showBackdrop={false}
        closeOnOutsideClick
      >
        <div>Drawer content</div>
      </Drawer>
    ));

    vi.runAllTimers();

    // Click outside the drawer — should close
    fireEvent.click(outsideElement);
    vi.runAllTimers();

    expect(onClose).toHaveBeenCalled();

    // Clean up
    outsideElement.remove();
  });

  it('does not close on outside click when target matches outsideClickIgnoreSelector', () => {
    const onClose = vi.fn();

    const outsideElement = document.createElement('div');
    outsideElement.className = 'ignore-me';
    const child = document.createElement('span');
    outsideElement.appendChild(child);
    document.body.appendChild(outsideElement);

    render(() => (
      <Drawer
        title="Drawer ignore selector"
        onClose={onClose}
        showBackdrop={false}
        closeOnOutsideClick
        outsideClickIgnoreSelector=".ignore-me"
      >
        <div>Drawer content</div>
      </Drawer>
    ));

    vi.runAllTimers();

    fireEvent.click(child);
    vi.runAllTimers();

    expect(onClose).not.toHaveBeenCalled();

    outsideElement.remove();
  });

  it('supports comma-separated outsideClickIgnoreSelector', () => {
    const onClose = vi.fn();

    const outsideElement = document.createElement('div');
    outsideElement.className = 'channel-tree-item';
    document.body.appendChild(outsideElement);

    render(() => (
      <Drawer
        title="Drawer ignore selector list"
        onClose={onClose}
        showBackdrop={false}
        closeOnOutsideClick
        outsideClickIgnoreSelector="tbody tr, .channel-tree-item"
      >
        <div>Drawer content</div>
      </Drawer>
    ));

    vi.runAllTimers();

    fireEvent.click(outsideElement);
    vi.runAllTimers();

    expect(onClose).not.toHaveBeenCalled();

    outsideElement.remove();
  });
});

describe('Drawer visual viewport pinning', () => {
  afterEach(() => {
    cleanup();
    delete (window as { visualViewport?: unknown }).visualViewport;
  });

  it('pins the root to the visual viewport when the page is zoomed out', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        width: 390,
        height: 600,
        offsetLeft: 733,
        offsetTop: 0,
      }),
    });

    render(() => (
      <Drawer title="Pinned" onClose={() => {}}>
        <div />
      </Drawer>
    ));

    const root = screen.getByTestId('drawer-root');
    expect(root.style.left).toBe('733px');
    expect(root.style.width).toBe('390px');
    expect(root.style.height).toBe('600px');
    const panel = root.querySelector('[data-drawer-panel]') as HTMLElement;
    expect(panel.style.height).toBe('100%');
  });
});
