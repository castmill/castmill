import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import '@testing-library/jest-dom';
import { BaseMenu, MenuEntry } from '../src/components/basemenu.component';

describe('BaseMenu component', () => {
  let mockEntries: MenuEntry[] = [];
  beforeEach(() => {
    mockEntries = [
      { name: 'Action Item', id: 'action1', type: 'action', action: vi.fn() },
      {
        name: 'Checkbox Item',
        id: 'checkbox1',
        type: 'checkbox',
        state: false,
        action: vi.fn(),
      },
      {
        name: 'Submenu Item',
        id: 'submenu1',
        type: 'submenu',
        action: vi.fn(),
        children: [
          {
            name: 'Sub Action',
            id: 'subaction1',
            type: 'action',
            action: vi.fn(),
          },
          {
            name: 'Sub Checkbox',
            id: 'checkbox2',
            type: 'checkbox',
            state: true,
            action: vi.fn(),
          },
        ],
      },
    ];
  });

  it('shows menu on click', () => {
    const { queryByRole } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));
    const menu = queryByRole('menu');

    // Initially, the menu should be hidden
    expect(menu).not.toBeInTheDocument();

    // Simulate an event that shows the menu
    fireEvent.click(window);
    expect(queryByRole('menu')).toBeVisible();
  });

  it('shows menu on touch', () => {
    const { queryByRole } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));
    const menu = queryByRole('menu');

    // Initially, the menu should be hidden
    expect(menu).not.toBeInTheDocument();

    // Simulate an event that shows the menu
    fireEvent.touchStart(window);
    expect(queryByRole('menu')).toBeVisible();
  });

  it('shows menu on key press', () => {
    const { queryByRole } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));
    const menu = queryByRole('menu');

    // Initially, the menu should be hidden
    expect(menu).not.toBeInTheDocument();

    // Simulate an event that shows the menu
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(queryByRole('menu')).toBeVisible();

    // Simulate an event that hides the menu
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape', charCode: 27 });
    expect(queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders with provided header and entries', () => {
    const { queryByText } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));

    // Simulate an event that shows the menu
    fireEvent.click(window);

    expect(queryByText('Menu Header')).to.exist;
    expect(queryByText('Action Item')).to.exist;
    expect(queryByText('Sub Action')).to.not.exist;
  });

  it('responds to keyboard interactions', () => {
    const { queryByRole, queryByText } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));
    const menu = queryByRole('menu');

    // Simulate an event that shows the menu
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(queryByRole('menu')).toBeVisible();

    // Simulate keyboard interactions
    fireEvent.keyDown(window, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      charCode: 40,
    });
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', charCode: 13 });

    // First checkbox should have been toggled from false to true
    expect(mockEntries[1].action).toHaveBeenCalledWith(true);

    fireEvent.keyDown(window, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      charCode: 40,
    });
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', charCode: 13 });

    // Submenu should have been opened
    expect(mockEntries[2].action).toHaveBeenCalled();
    expect(queryByText('Sub Action')).to.exist;

    // Simulate keyboard interactions within submenu
    fireEvent.keyDown(window, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      charCode: 40,
    });
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', charCode: 13 });

    // Submenu action should have been called
    expect(mockEntries[2].children[0].action).toHaveBeenCalled();

    fireEvent.keyDown(window, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      charCode: 40,
    });
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter', charCode: 13 });

    // Submenu checkbox should have been toggled from true to false
    expect(mockEntries[2].children[1].action).toHaveBeenCalledWith(false);
  });

  it('responds to mouse interactions', () => {
    const { queryByRole, queryByText } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));
    const menu = queryByRole('menu');

    // Simulate an event that shows the menu
    fireEvent.click(window);
    expect(queryByRole('menu')).toBeVisible();

    // Simulate mouse interactions
    fireEvent.click(queryByText(/Submenu Item/));
    expect(mockEntries[2].action).toHaveBeenCalled();
    expect(queryByText('Sub Action')).to.exist;
    expect(mockEntries[2].children[0].action).not.toHaveBeenCalled();
    fireEvent.click(queryByText('Sub Action'));
    expect(mockEntries[2].children[0].action).toHaveBeenCalled();
  });

  it('hides menu after timeout', () => {
    vi.useFakeTimers();
    const { queryByRole } = render(() => (
      <BaseMenu header={<div>Menu Header</div>} entries={mockEntries} />
    ));
    const menu = queryByRole('menu');

    // Simulate an event that shows the menu
    fireEvent.click(window);
    expect(queryByRole('menu')).toBeVisible();

    // Advance timers by the timeout duration
    vi.runAllTimers();

    // Assert the menu is no longer visible
    expect(queryByRole('menu')).not.toBeInTheDocument();
  });
});
