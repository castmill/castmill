import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';
import DropdownMenu from './dropdown-menu';

// Simple ButtonComponent for testing
const TestButtonComponent = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick}>Toggle</button>
);

// Skipping due to this issue: https://github.com/solidjs/solid-testing-library/issues/55
describe.skip('DropdownMenu Component', () => {
  beforeEach(() => {
    cleanup();
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => {
      return {
        width: 100,
        height: 50,
        top: 200,
        left: 200,
        bottom: 250,
        right: 300,
        x: 200,
        y: 200,
        toJSON: () => {},
      };
    });
  });

  afterEach(() => {
    // Restore the original getBoundingClientRect function after each test
    vi.restoreAllMocks();
  });

  it('renders and toggles the dropdown menu', async () => {
    const { queryByText, getByText } = render(() => (
      <DropdownMenu ButtonComponent={TestButtonComponent}>
        <div>Menu Item 1</div>
        <div>Menu Item 2</div>
      </DropdownMenu>
    ));

    // Initially, the dropdown should not show its items
    expect(screen.queryByText('Menu Item 1')).not.toBeVisible();
    expect(screen.queryByText('Menu Item 2')).not.toBeVisible();

    // Toggle the dropdown to open
    fireEvent.click(getByText('Toggle'));
    expect(screen.queryByText('Menu Item 1')).toBeVisible();
    expect(screen.queryByText('Menu Item 2')).toBeVisible();

    // Toggle the dropdown to close
    fireEvent.click(getByText('Toggle'));
    expect(queryByText('Menu Item 1')).not.toBeVisible();
    expect(queryByText('Menu Item 2')).not.toBeVisible();
  });

  it('closes the dropdown when clicking outside', () => {
    const { baseElement } = render(() => (
      <DropdownMenu ButtonComponent={TestButtonComponent}>
        <div>Menu Item 1</div>
        <div>Menu Item 2</div>
      </DropdownMenu>
    ));

    // Open the dropdown
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByText('Menu Item 1')).toBeVisible();

    // Simulate clicking outside the dropdown
    fireEvent.mouseDown(baseElement);
    expect(screen.queryByText('Menu Item 1')).not.toBeVisible();
  });

  it('closes the dropdown when clicking a menu item button', () => {
    const handleClick = vi.fn();
    const { getByText } = render(() => (
      <DropdownMenu ButtonComponent={TestButtonComponent}>
        <button onClick={handleClick}>Action Button</button>
        <div>Menu Item 2</div>
      </DropdownMenu>
    ));

    // Open the dropdown
    fireEvent.click(getByText('Toggle'));
    expect(screen.getByText('Action Button')).toBeVisible();

    // Click the menu item button
    fireEvent.click(getByText('Action Button'));

    // Verify the button action was called
    expect(handleClick).toHaveBeenCalledOnce();

    // Verify the dropdown is closed
    expect(screen.queryByText('Action Button')).not.toBeVisible();
  });

  it('closes the dropdown when clicking a menu item link', () => {
    const { getByText } = render(() => (
      <DropdownMenu ButtonComponent={TestButtonComponent}>
        <a href="/test">Link Item</a>
        <div>Menu Item 2</div>
      </DropdownMenu>
    ));

    // Open the dropdown
    fireEvent.click(getByText('Toggle'));
    expect(screen.getByText('Link Item')).toBeVisible();

    // Click the link
    fireEvent.click(getByText('Link Item'));

    // Verify the dropdown is closed
    expect(screen.queryByText('Link Item')).not.toBeVisible();
  });
});
