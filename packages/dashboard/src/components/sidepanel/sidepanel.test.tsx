import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import SidePanel from './sidepanel';
import { AddOnTree } from '../../classes/addon-tree';
import { navDrawer, navModeFor } from './nav-drawer';
import {
  DESKTOP,
  PHONE,
  TABLET_LANDSCAPE,
  TABLET_PORTRAIT,
  mockViewport,
} from './viewport.test-utils';

const [pathname, setPathname] = createSignal('/org/org-1/channels');

vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({
    get pathname() {
      return pathname();
    },
  }),
  A: (props: { href: string; title?: string; children?: any }) => (
    <a href={props.href} title={props.title}>
      {props.children}
    </a>
  ),
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/permissions.service', () => ({
  canPerformAction: () => true,
}));

vi.mock('../../store/store', () => ({
  store: {
    organizations: {
      data: [{ id: 'org-1', name: 'Org One' }],
      selectedId: 'org-1',
      selectedName: 'Org One',
    },
    permissions: { role: 'admin', matrix: {} },
    network: { isAdmin: false },
  },
  setStore: vi.fn(),
}));

const originalMatchMedia = window.matchMedia;

const renderPanel = () =>
  render(() => (
    <>
      <button type="button" data-testid="opener">
        menu
      </button>
      <SidePanel addons={new AddOnTree([])} />
    </>
  ));

const panel = () => document.getElementById('castmill-sidepanel')!;

describe('SidePanel responsive navigation', () => {
  beforeEach(() => {
    setPathname('/org/org-1/channels');
    navDrawer.close();
  });

  afterEach(() => {
    cleanup();
    navDrawer.close();
    window.matchMedia = originalMatchMedia;
    document.body.style.overflow = '';
  });

  it('maps viewport queries to layout modes', () => {
    expect(navModeFor(true, true)).toBe('drawer');
    expect(navModeFor(false, true)).toBe('rail');
    expect(navModeFor(false, false)).toBe('static');
  });

  it('is a static panel on desktop and ignores the drawer state', () => {
    mockViewport(DESKTOP);
    renderPanel();
    expect(panel()).toHaveAttribute('data-mode', 'static');
    expect(panel()).toHaveAttribute('aria-label', 'sidebar.navigation');

    navDrawer.open();
    expect(navDrawer.isOpen()).toBe(false);
    expect(panel()).not.toHaveAttribute('role');
    expect(screen.queryByTestId('sidepanel-backdrop')).toBeNull();
  });

  it('is an icon rail on landscape tablets that expands into a drawer', () => {
    mockViewport(TABLET_LANDSCAPE);
    renderPanel();
    expect(panel()).toHaveAttribute('data-mode', 'rail');
    expect(panel()).not.toHaveClass('is-open');
    // Rail items keep their label as tooltip.
    expect(screen.getByText('sidebar.channels').closest('a')).toHaveAttribute(
      'title',
      'sidebar.channels'
    );

    navDrawer.open();
    expect(panel()).toHaveClass('is-open');
    expect(panel()).toHaveAttribute('role', 'dialog');
  });

  it.each([
    ['phone', PHONE],
    ['portrait tablet', TABLET_PORTRAIT],
  ])('is an off-canvas drawer on a %s', (_, viewport) => {
    mockViewport(viewport);
    renderPanel();
    expect(panel()).toHaveAttribute('data-mode', 'drawer');
    expect(panel()).not.toHaveClass('is-open');
    expect(screen.queryByTestId('sidepanel-backdrop')).toBeNull();
  });

  it('opens as a modal dialog, locks scrolling and focuses the drawer', () => {
    mockViewport(PHONE);
    renderPanel();
    const opener = screen.getByTestId('opener');
    opener.focus();

    navDrawer.open();
    expect(panel()).toHaveClass('is-open');
    expect(panel()).toHaveAttribute('role', 'dialog');
    expect(panel()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('sidepanel-backdrop')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'common.close' })
    );

    navDrawer.close();
    expect(document.body.style.overflow).toBe('');
    // Focus returns to the element that opened the drawer.
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape, backdrop tap and the close button', () => {
    mockViewport(PHONE);
    renderPanel();

    navDrawer.open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(navDrawer.isOpen()).toBe(false);

    navDrawer.open();
    fireEvent.click(screen.getByTestId('sidepanel-backdrop'));
    expect(navDrawer.isOpen()).toBe(false);

    navDrawer.open();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(navDrawer.isOpen()).toBe(false);
  });

  it('closes on navigation', () => {
    mockViewport(PHONE);
    renderPanel();
    navDrawer.open();
    setPathname('/org/org-1/teams');
    expect(navDrawer.isOpen()).toBe(false);
    expect(panel()).not.toHaveClass('is-open');
  });

  it('closes when the viewport grows to the desktop layout', () => {
    const viewport = mockViewport(PHONE);
    renderPanel();
    navDrawer.open();
    viewport.resize(DESKTOP);
    expect(panel()).toHaveAttribute('data-mode', 'static');
    expect(navDrawer.isOpen()).toBe(false);
  });

  it('traps focus inside the open drawer', () => {
    mockViewport(PHONE);
    renderPanel();
    navDrawer.open();

    const focusables = Array.from(
      panel().querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    expect(first).toBe(screen.getByRole('button', { name: 'common.close' }));

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    // Focus that escaped the drawer is pulled back in.
    screen.getByTestId('opener').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    // Tabbing between inner items is left to the browser.
    first.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('suspends the drawer focus trap while a modal is present', () => {
    mockViewport(PHONE);
    renderPanel();
    navDrawer.open();

    const overlay = document.createElement('div');
    overlay.dataset.modalOverlay = '';
    const modalClose = document.createElement('button');
    overlay.append(modalClose);
    document.body.append(overlay);
    modalClose.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(modalClose);
    overlay.remove();
  });

  it('preserves the original opener when the viewport changes while open', () => {
    const viewport = mockViewport(PHONE);
    renderPanel();
    const opener = screen.getByTestId('opener');
    opener.focus();
    navDrawer.open();

    viewport.resize(TABLET_LANDSCAPE);
    expect(panel()).toHaveAttribute('data-mode', 'rail');
    expect(panel()).toHaveClass('is-open');
    navDrawer.close();

    expect(document.activeElement).toBe(opener);
  });

  it('registers itself so the top bar can show the menu button', () => {
    mockViewport(PHONE);
    expect(navDrawer.isAvailable()).toBe(false);
    const { unmount } = renderPanel();
    expect(navDrawer.isAvailable()).toBe(true);
    navDrawer.open();
    unmount();
    expect(navDrawer.isAvailable()).toBe(false);
    expect(navDrawer.isOpen()).toBe(false);
  });

  it('keeps organization-scoped links', () => {
    mockViewport(PHONE);
    renderPanel();
    expect(screen.getByText('sidebar.teams').closest('a')).toHaveAttribute(
      'href',
      '/org/org-1/teams'
    );
  });
});
