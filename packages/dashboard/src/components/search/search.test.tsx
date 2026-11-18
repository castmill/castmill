import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import Search from './search';

const navigate = vi.hoisted(() => vi.fn());
const keyboardShortcuts = vi.hoisted(() => ({
  registerShortcut: vi.fn(),
  unregisterShortcut: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks', () => ({
  useKeyboardShortcuts: () => ({
    ...keyboardShortcuts,
    formatShortcut: () => 'Ctrl+F',
    isMac: false,
  }),
}));

describe('Search', () => {
  afterEach(() => {
    cleanup();
    navigate.mockReset();
    keyboardShortcuts.registerShortcut.mockReset();
    keyboardShortcuts.unregisterShortcut.mockReset();
  });

  it('does not steal focus by default', () => {
    render(() => <Search />);
    expect(document.activeElement).not.toBe(
      screen.getByRole('textbox', { name: 'common.search' })
    );
  });

  it('focuses the input when autoFocus is set (compact top bar)', () => {
    render(() => <Search autoFocus />);
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'common.search' })
    );
  });

  it('calls onDone after submitting and on Escape', () => {
    const onDone = vi.fn();
    render(() => <Search autoFocus onDone={onDone} />);
    const input = screen.getByRole('textbox', { name: 'common.search' });

    fireEvent.input(input, { target: { value: 'lobby' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/search?s=lobby');
    expect(onDone).toHaveBeenNthCalledWith(1, true);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onDone).toHaveBeenNthCalledWith(2, false);
  });

  it('can leave global shortcut registration to its parent', () => {
    const { unmount } = render(() => <Search registerGlobalShortcut={false} />);
    expect(keyboardShortcuts.registerShortcut).not.toHaveBeenCalled();

    unmount();
    expect(keyboardShortcuts.unregisterShortcut).not.toHaveBeenCalled();
  });
});
