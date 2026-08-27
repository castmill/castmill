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
});
