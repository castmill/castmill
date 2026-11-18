/** @jsxImportSource solid-js */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@solidjs/testing-library';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  afterEach(() => {
    cleanup();
    // Clean up portal elements
    const overlays = document.body.querySelectorAll(
      '[data-testid="modal-overlay"]'
    );
    overlays.forEach((overlay) => overlay.remove());
  });

  it('should render correctly when shown', async () => {
    render(() => (
      <ConfirmDialog
        show={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('uses custom button labels', () => {
    render(() => (
      <ConfirmDialog
        show={true}
        title="Clear?"
        message="Clears photos"
        confirmLabel="Rensa"
        cancelLabel="Avbryt"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByText('Rensa')).toBeInTheDocument();
    expect(screen.getByText('Avbryt')).toBeInTheDocument();
  });

  it('should not render when not shown', () => {
    render(() => (
      <ConfirmDialog
        show={false}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('should call onConfirm when the Confirm button is clicked', async () => {
    const onConfirmMock = vi.fn();
    render(() => (
      <ConfirmDialog
        show={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={onConfirmMock}
        onClose={vi.fn()}
      />
    ));
    const confirmButton = screen.getByText('Confirm');
    await fireEvent.click(confirmButton);
    expect(onConfirmMock).toHaveBeenCalled();
  });

  it('should call onClose when the Cancel button is clicked', async () => {
    const onCloseMock = vi.fn();
    render(() => (
      <ConfirmDialog
        show={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onClose={onCloseMock}
      />
    ));
    const cancelButton = screen.getByText('Cancel');
    await fireEvent.click(cancelButton);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('marks its buttons as the modal action row for phone layouts', () => {
    render(() => (
      <ConfirmDialog
        show={true}
        title="Delete?"
        message="This cannot be undone"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    const actions = screen.getByText('Confirm').closest('[data-modal-actions]');
    expect(actions).not.toBeNull();
    expect(actions!.contains(screen.getByText('Cancel'))).toBe(true);
    expect(actions!.closest('[class*="modalBody"]')).not.toBeNull();
  });
});
