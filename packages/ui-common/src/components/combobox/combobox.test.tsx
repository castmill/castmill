/** @jsxImportSource solid-js */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  fireEvent,
  cleanup,
  screen,
  waitFor,
} from '@solidjs/testing-library';

import { ComboBox } from './combobox';

describe('ComboBox Component', () => {
  afterEach(cleanup);

  const mockItems = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ];

  const renderComboBox = (
    overrides?: Partial<{
      onSelect: (item: { id: string; name: string }) => void;
      onClear: () => void;
    }>
  ) => {
    const fetchItems = vi.fn(async () => ({
      count: mockItems.length,
      data: mockItems,
    }));
    const onSelect = overrides?.onSelect ?? vi.fn();
    const onClear = overrides?.onClear;

    render(() => (
      <ComboBox
        id="test-combo"
        label="Test ComboBox"
        fetchItems={fetchItems}
        renderItem={(item) => <div>{item.name}</div>}
        onSelect={onSelect}
        onClear={onClear}
      />
    ));

    return { fetchItems, onSelect, onClear };
  };

  it('toggles dropdown when clicking header label area', async () => {
    renderComboBox();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByText('Test ComboBox'));
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    );

    await fireEvent.click(screen.getByText('Test ComboBox'));
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    );
  });

  it('opens and closes dropdown when clicking toggle icon button', async () => {
    renderComboBox();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByLabelText('Toggle Dropdown'));
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    );

    await fireEvent.click(screen.getByLabelText('Toggle Dropdown'));
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    );
  });

  it('closes dropdown when pointerdown happens outside component', async () => {
    renderComboBox();

    await fireEvent.click(screen.getByLabelText('Toggle Dropdown'));
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    );

    await fireEvent.pointerDown(document.body);

    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    );
  });

  it('calls onSelect and closes dropdown when an item is selected', async () => {
    const onSelect = vi.fn();
    renderComboBox({ onSelect });

    await fireEvent.click(screen.getByLabelText('Toggle Dropdown'));
    const item = await screen.findByText('Item 1');

    await fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledWith({ id: '1', name: 'Item 1' });
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    );
  });

  it('supports keyboard toggle on header trigger', async () => {
    renderComboBox();

    const trigger = screen.getByRole('button', { name: /test combobox/i });
    trigger.focus();

    await fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    );

    await fireEvent.keyDown(trigger, { key: ' ' });
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    );
  });

  it('does not open dropdown when clear is clicked while closed', async () => {
    const onClear = vi.fn();
    const fetchItems = vi.fn(async () => ({ count: 1, data: mockItems }));

    render(() => (
      <ComboBox
        id="test-clear"
        label="Test ComboBox"
        fetchItems={fetchItems}
        renderItem={(item) => <div>{item.name}</div>}
        onSelect={vi.fn()}
        value={{ id: '1', name: 'Item 1' }}
        clearable
        onClear={onClear}
      />
    ));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByLabelText('Clear selection'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
