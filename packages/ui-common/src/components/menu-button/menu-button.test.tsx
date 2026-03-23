/** @jsxImportSource solid-js */

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuButton } from './menu-button';

afterEach(() => {
  cleanup();
});

describe('MenuButton', () => {
  it('renders closed by default with medium size class', () => {
    const { container } = render(() => (
      <MenuButton
        label="Actions"
        items={[{ key: 'one', label: 'One', onClick: vi.fn() }]}
      />
    ));

    const root = container.querySelector('.castmill-menu-button');
    expect(root).toBeInTheDocument();
    expect(root).toHaveClass('castmill-menu-button-size-medium');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens and closes when trigger is clicked', async () => {
    render(() => (
      <MenuButton
        label="Actions"
        items={[{ key: 'one', label: 'One', onClick: vi.fn() }]}
      />
    ));

    const trigger = screen.getByRole('button', { name: /Actions/i });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when clicking outside', async () => {
    render(() => (
      <MenuButton
        label="Actions"
        items={[{ key: 'one', label: 'One', onClick: vi.fn() }]}
      />
    ));

    const trigger = screen.getByRole('button', { name: /Actions/i });
    await fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await fireEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls item callback and closes menu on item click', async () => {
    const onClick = vi.fn();

    render(() => (
      <MenuButton
        label="Actions"
        items={[{ key: 'save', label: 'Save', onClick }]}
      />
    ));

    await fireEvent.click(screen.getByRole('button', { name: /Actions/i }));

    const item = screen.getByRole('menuitem', { name: 'Save' });
    await fireEvent.click(item);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('respects disabled state for trigger and menu items', async () => {
    const onClick = vi.fn();

    render(() => (
      <MenuButton
        label="Actions"
        disabled
        items={[{ key: 'save', label: 'Save', onClick, disabled: true }]}
      />
    ));

    const trigger = screen.getByRole('button', { name: /Actions/i });
    expect(trigger).toBeDisabled();

    await fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('applies explicit size classes', () => {
    const { container, unmount } = render(() => (
      <MenuButton
        label="Actions"
        size="small"
        items={[{ key: 'one', label: 'One', onClick: vi.fn() }]}
      />
    ));

    let root = container.querySelector('.castmill-menu-button');
    expect(root).toHaveClass('castmill-menu-button-size-small');

    unmount();

    const { container: largeContainer } = render(() => (
      <MenuButton
        label="Actions"
        size="large"
        items={[{ key: 'one', label: 'One', onClick: vi.fn() }]}
      />
    ));

    root = largeContainer.querySelector('.castmill-menu-button');
    expect(root).toHaveClass('castmill-menu-button-size-large');
  });
});
