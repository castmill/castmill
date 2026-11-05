/** @jsxImportSource solid-js */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  fireEvent,
  cleanup,
  screen,
  waitFor,
} from '@solidjs/testing-library';

import { ComboBox } from './combobox';

const comboBoxCss = readFileSync(
  resolve('src/components/combobox/combobox.module.scss'),
  'utf8'
);

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

  it('positions the dropdown as an overlay', () => {
    expect(comboBoxCss).toMatch(/\.combo-box\s*{[^}]*position:\s*relative/s);
    expect(comboBoxCss).toMatch(/\.dropdown\s*{[^}]*position:\s*absolute/s);
  });

  it('uses compact padding on the trigger', () => {
    expect(comboBoxCss).toMatch(/\.header\s*{[^}]*padding:\s*0\.5em/s);
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
    expect(screen.queryByLabelText('Toggle Dropdown')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Clear selection')).toBeInTheDocument();

    await fireEvent.click(screen.getByLabelText('Clear selection'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Toggle Dropdown')).toBeInTheDocument();
  });

  describe('placement', () => {
    const originalMatchMedia = window.matchMedia;

    const mockSheetQuery = (matches: boolean) => {
      window.matchMedia = vi.fn((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    };

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
      vi.restoreAllMocks();
    });

    it('opens a bottom sheet on small or touch screens', async () => {
      mockSheetQuery(true);
      const onSelect = vi.fn();
      render(() => (
        <ComboBox
          id="sheet-combo"
          label="Media"
          closeLabel="Close picker"
          fetchItems={async () => ({ count: 2, data: mockItems })}
          renderItem={(item) => <div>{item.name}</div>}
          onSelect={onSelect}
        />
      ));

      await fireEvent.click(screen.getByText('Media'));

      const sheet = await screen.findByRole('dialog', { name: 'Media' });
      expect(sheet.closest('[data-combobox-sheet]')).not.toBeNull();
      expect(document.body.style.overflow).toBe('hidden');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      await fireEvent.click(await screen.findByText('Item 2'));

      expect(onSelect).toHaveBeenCalledWith({ id: '2', name: 'Item 2' });
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      expect(document.body.style.overflow).toBe('');
    });

    it('closes the sheet with Escape before outer layers see it', async () => {
      mockSheetQuery(true);
      const outerKeydown = vi.fn();
      document.addEventListener('keydown', outerKeydown, true);
      renderComboBox();

      await fireEvent.click(screen.getByText('Test ComboBox'));
      await screen.findByRole('dialog');

      await fireEvent.keyDown(document.body, { key: 'Escape' });

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
      expect(outerKeydown).not.toHaveBeenCalled();
      document.removeEventListener('keydown', outerKeydown, true);
    });

    it('closes the sheet from the backdrop and close button', async () => {
      mockSheetQuery(true);
      renderComboBox();

      await fireEvent.click(screen.getByText('Test ComboBox'));
      const sheet = await screen.findByRole('dialog');
      await fireEvent.click(sheet.parentElement!);
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );

      await fireEvent.click(screen.getByText('Test ComboBox'));
      await screen.findByRole('dialog');
      await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      );
    });

    it('opens upwards when there is no room below the trigger', async () => {
      mockSheetQuery(false);
      renderComboBox();
      const trigger = screen.getByRole('button', { name: /test combobox/i });
      vi.spyOn(trigger.parentElement!, 'getBoundingClientRect').mockReturnValue(
        {
          top: window.innerHeight - 60,
          bottom: window.innerHeight - 10,
          left: 0,
          right: 300,
          width: 300,
          height: 50,
          x: 0,
          y: window.innerHeight - 60,
          toJSON: () => ({}),
        }
      );

      await fireEvent.click(screen.getByText('Test ComboBox'));

      const listbox = await screen.findByRole('listbox');
      expect(listbox.className).toMatch(/dropdown-up/);
    });
  });
});
