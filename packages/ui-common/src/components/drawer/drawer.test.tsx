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
    vi.restoreAllMocks();
    vi.runAllTimers();
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
});
