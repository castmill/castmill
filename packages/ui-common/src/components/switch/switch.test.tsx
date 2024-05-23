import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';

import { Switch } from './switch';
import styles from './switch.module.scss'; // Import the styles for accurate class references

describe('Switch component', () => {
    afterEach(() => cleanup());

  it('renders with correct active state and can be toggled', async () => {
    const onToggle = vi.fn();
    render(() => (
      <Switch
        name="Test Switch"
        key="testKey"
        isActive={false}
        disabled={false}
        onToggle={onToggle}
      />
    ));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('testKey');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders as disabled when the disabled prop is true', () => {
    render(() => (
      <Switch
        name="Disabled Switch"
        key="disabledKey"
        isActive={false}
        disabled={true}
        onToggle={() => {}}
      />
    ));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('does not toggle when disabled', async () => {
    const onToggle = vi.fn();
    render(() => (
      <Switch
        name="Non-toggling Switch"
        key="nontoggleKey"
        isActive={true}
        disabled={true}
        onToggle={onToggle}
      />
    ));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();

    await fireEvent.click(checkbox);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('reflects active state correctly and can be toggled to active', async () => {
    const onToggle = vi.fn();
    render(() => (
      <Switch
        name="Active Switch"
        key="activeKey"
        isActive={true}
        disabled={false}
        onToggle={onToggle}
      />
    ));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    await fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('activeKey');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
