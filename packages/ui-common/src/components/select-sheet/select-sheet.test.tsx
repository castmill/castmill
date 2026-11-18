import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { mockMatchMedia } from '../../testing';
import { NATIVE_SELECT_ATTRIBUTE, SelectSheetHost } from './select-sheet';

const originalMatchMedia = window.matchMedia;

const mockSheetQuery = (matches: boolean) => mockMatchMedia(matches);

const touch = (target: Element, type: 'touchstart' | 'touchend', y = 10) => {
  const point = { clientX: 10, clientY: y, target } as unknown as Touch;
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: type === 'touchstart' ? [point] : [],
  });
  Object.defineProperty(event, 'changedTouches', { value: [point] });
  target.dispatchEvent(event);
  return event;
};

const SortSelect = (props: { onChange?: (value: string) => void }) => {
  const [value, setValue] = createSignal('name');
  return (
    <>
      <SelectSheetHost closeLabel="Stäng" fallbackTitle="Choose" />
      <label for="sort">Sort by</label>
      <select
        id="sort"
        value={value()}
        onChange={(e) => {
          setValue(e.currentTarget.value);
          props.onChange?.(e.currentTarget.value);
        }}
      >
        <option value="name">Name</option>
        <option value="role">Role</option>
        <optgroup label="Dates">
          <option value="created">Created</option>
          <option value="old" disabled>
            Old
          </option>
        </optgroup>
      </select>
    </>
  );
};

describe('SelectSheetHost', () => {
  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
    document.body.style.overflow = '';
  });

  it('keeps the native picker on desktop', () => {
    mockSheetQuery(false);
    render(() => <SortSelect />);

    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    screen.getByLabelText('Sort by').dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a labelled sheet instead of the native popup on mobile', () => {
    mockSheetQuery(true);
    render(() => <SortSelect />);
    const select = screen.getByLabelText('Sort by');

    expect(touch(select, 'touchstart').defaultPrevented).toBe(false);
    const end = touch(select, 'touchend');

    expect(end.defaultPrevented).toBe(true);
    const dialog = screen.getByRole('dialog', { name: 'Sort by' });
    expect(dialog.closest('[data-combobox-sheet]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Stäng' })).toBeTruthy();
    expect(screen.getByText('Dates')).toBeTruthy();
    expect(
      within(screen.getByRole('dialog'))
        .getByRole('option', { name: 'Name' })
        .getAttribute('aria-selected')
    ).toBe('true');
    expect(
      (
        within(screen.getByRole('dialog')).getByRole('option', {
          name: 'Old',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('updates the select and fires native change events', () => {
    mockSheetQuery(true);
    const onChange = vi.fn();
    const onInput = vi.fn();
    render(() => <SortSelect onChange={onChange} />);
    const select = screen.getByLabelText('Sort by') as HTMLSelectElement;
    select.addEventListener('input', onInput);

    fireEvent.mouseDown(select);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('option', {
        name: 'Created',
      })
    );

    expect(onChange).toHaveBeenCalledWith('created');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(select.value).toBe('created');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(select);
  });

  it('keeps sheet taps from reaching outside-click handlers', () => {
    mockSheetQuery(true);
    const outside = vi.fn();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('click', outside);
    const onChange = vi.fn();
    render(() => <SortSelect onChange={onChange} />);

    fireEvent.mouseDown(screen.getByLabelText('Sort by'));
    const option = within(screen.getByRole('dialog')).getByRole('option', {
      name: 'Role',
    });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    expect(outside).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith('role');
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('click', outside);
  });

  it('ignores scroll gestures, opt-outs, and multi-selects', () => {
    mockSheetQuery(true);
    render(() => (
      <>
        <SelectSheetHost />
        <select aria-label="Scrolled">
          <option>A</option>
        </select>
        <select aria-label="Native" {...{ [NATIVE_SELECT_ATTRIBUTE]: '' }}>
          <option>A</option>
        </select>
        <select aria-label="Many" multiple>
          <option>A</option>
        </select>
      </>
    ));

    const scrolled = screen.getByLabelText('Scrolled');
    touch(scrolled, 'touchstart', 10);
    expect(touch(scrolled, 'touchend', 80).defaultPrevented).toBe(false);

    fireEvent.mouseDown(screen.getByLabelText('Native'));
    fireEvent.mouseDown(screen.getByLabelText('Many'));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens from the keyboard and closes with Escape before outer handlers', () => {
    mockSheetQuery(true);
    const outerEscape = vi.fn();
    document.addEventListener('keydown', outerEscape, true);
    render(() => <SortSelect />);
    const select = screen.getByLabelText('Sort by');
    select.focus();

    fireEvent.keyDown(select, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(outerEscape).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(select);
    document.removeEventListener('keydown', outerEscape, true);
  });
});
