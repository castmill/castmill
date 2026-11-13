import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import Topbar, { userInitial } from './topbar';
import { ThemeProvider } from '../../theme';
import { navDrawer } from '../sidepanel/nav-drawer';
import {
  DESKTOP,
  PHONE,
  TABLET_LANDSCAPE,
  TABLET_PORTRAIT,
  mockViewport,
} from '../sidepanel/viewport.test-utils';

// Mock the auth module
vi.mock('../auth', () => ({
  checkAuth: () => true,
  getUser: () => ({ name: 'Test User', email: 'test@example.com' }),
  resetSession: vi.fn(),
  authFetch: vi.fn(),
}));

// Mock router
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
  A: (props: { href: string; children?: any }) => (
    <a href={props.href}>{props.children}</a>
  ),
}));

// Mock the search component
vi.mock('../search/search', () => ({
  default: (props: { autoFocus?: boolean; onDone?: () => void }) => (
    <div data-testid="search" data-autofocus={String(!!props.autoFocus)}>
      Search
      <button type="button" onClick={() => props.onDone?.()}>
        search-done
      </button>
    </div>
  ),
}));

// Mock the notification bell
vi.mock('../notification-bell/notification-bell', () => ({
  default: () => <div>NotificationBell</div>,
}));

// Mock dropdown menu
vi.mock('../dropdown-menu/dropdown-menu', () => ({
  default: (props: { ButtonComponent: any; children: any }) => (
    <div>
      <props.ButtonComponent />
      {props.children}
    </div>
  ),
}));

// Mock language selector
vi.mock('../language-selector/language-selector', () => ({
  default: () => <div>LanguageSelector</div>,
}));

// Mock shortcuts legend
vi.mock('../shortcuts-legend/shortcuts-legend', () => ({
  ShortcutsLegend: () => <div>ShortcutsLegend</div>,
}));

// Mock global shortcuts
vi.mock('../global-shortcuts/global-shortcuts', () => ({
  GlobalShortcuts: () => <div>GlobalShortcuts</div>,
}));

// Mock loading progress bar
vi.mock('../loading-progress-bar/loading-progress-bar', () => ({
  LoadingProgressBar: () => <div>LoadingProgressBar</div>,
}));

// Mock the organization logo hook
vi.mock('../../hooks/use-selected-organization-logo', () => ({
  useSelectedOrganizationLogo: () => ({
    logoUrl: () => null,
  }),
}));

// Mock the i18n hook
const mockSetLocale = vi.hoisted(() => vi.fn());
vi.mock('../../i18n', () => ({
  SUPPORTED_LOCALES: [
    { code: 'en', nativeName: 'English' },
    { code: 'ar', nativeName: 'العربية' },
  ],
  useI18n: () => ({
    locale: () => 'en',
    setLocale: mockSetLocale,
    t: (key: string) => {
      const translations: Record<string, string> = {
        'topbar.help': 'Help',
        'common.profile': 'Profile',
        'common.settings': 'Settings',
        'common.logout': 'Logout',
        'shortcuts.showShortcutsLegend': 'Show Shortcuts',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the store
const mockNetworkSettings = vi.hoisted(() => ({
  logo: '' as string,
  logoLight: '' as string,
}));

const mockCompleteStep = vi.hoisted(() => vi.fn());
const mockSetStore = vi.hoisted(() => vi.fn());
vi.mock('../../store/store', () => ({
  store: {
    loadingAddons: false,
    organizations: {
      selectedName: 'Test Org',
    },
    networkSettings: mockNetworkSettings,
    onboarding: { completeStep: mockCompleteStep },
  },
  setStore: mockSetStore,
}));

// Mock the logo import
vi.mock('../../assets/castmill-logo-topbar.png', () => ({
  default: 'logo.png',
}));

vi.mock('../../assets/castmill-logo-topbar-light.png', () => ({
  default: 'logo-light.png',
}));

const renderTopbar = () =>
  render(() => (
    <ThemeProvider>
      <Topbar />
    </ThemeProvider>
  ));

describe('Topbar Component', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    mockNetworkSettings.logo = '';
    mockNetworkSettings.logoLight = '';
    // Mock fetch for logout
    global.fetch = vi.fn();
  });

  it('renders the Help button with correct attributes', () => {
    renderTopbar();

    // Find the Help link
    const helpLink = screen.getByText('Help').closest('a');

    // Verify the link exists
    expect(helpLink).toBeTruthy();

    // Verify it points to the documentation
    expect(helpLink?.getAttribute('href')).toBe('https://docs.castmill.io');

    // Verify it opens in a new tab
    expect(helpLink?.getAttribute('target')).toBe('_blank');

    // Verify it has security attributes
    expect(helpLink?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders a theme toggle that switches between dark and light', () => {
    renderTopbar();

    const toggle = screen.getByTestId('theme-toggle');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggle).toHaveAttribute('aria-label', 'topbar.switchToLightMode');

    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(toggle).toHaveAttribute('aria-label', 'topbar.switchToDarkMode');
    expect(localStorage.getItem('castmill_theme')).toBe('light');
  });

  it('uses the logo variant matching the theme', () => {
    renderTopbar();
    const logo = screen.getByAltText('Castmill');
    expect(logo).toHaveAttribute('src', 'logo.png');

    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(logo).toHaveAttribute('src', 'logo-light.png');
  });

  it('uses the network light logo variant in light mode', () => {
    mockNetworkSettings.logo = 'https://example.com/net-dark.png';
    mockNetworkSettings.logoLight = 'https://example.com/net-light.png';
    renderTopbar();
    const logo = screen.getByAltText('Castmill');
    expect(logo).toHaveAttribute('src', 'https://example.com/net-dark.png');

    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(logo).toHaveAttribute('src', 'https://example.com/net-light.png');
    expect(logo.parentElement).not.toHaveClass('network-logo--dark-backdrop');
  });

  it('shows a dark-only network logo on a dark backdrop in light mode', () => {
    mockNetworkSettings.logo = 'https://example.com/net-dark.png';
    renderTopbar();
    const logo = screen.getByAltText('Castmill');
    expect(logo.parentElement).not.toHaveClass('network-logo--dark-backdrop');

    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(logo).toHaveAttribute('src', 'https://example.com/net-dark.png');
    expect(logo.parentElement).toHaveClass('network-logo--dark-backdrop');
  });
});

describe('userInitial', () => {
  it('returns the first character in upper case', () => {
    expect(userInitial(' alice ')).toBe('A');
    expect(userInitial('Ölund')).toBe('Ö');
    expect(userInitial('😀 Smile')).toBe('😀');
    expect(userInitial('')).toBe('?');
  });
});

describe('Topbar responsive layout', () => {
  const originalMatchMedia = window.matchMedia;
  let unregister: (() => void) | undefined;

  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    mockSetLocale.mockReset();
    mockCompleteStep.mockReset();
    mockSetStore.mockReset();
    mockNetworkSettings.logo = '';
    mockNetworkSettings.logoLight = '';
    navDrawer.close();
  });

  afterEach(() => {
    cleanup();
    unregister?.();
    unregister = undefined;
    navDrawer.close();
    window.matchMedia = originalMatchMedia;
  });

  const withSidePanel = () => {
    unregister = navDrawer.register();
  };

  it('keeps the full desktop bar without a menu button', () => {
    mockViewport(DESKTOP);
    withSidePanel();
    renderTopbar();
    expect(screen.queryByTestId('topbar-menu-button')).toBeNull();
    expect(screen.getByTestId('search')).toBeInTheDocument();
    expect(screen.getByText('LanguageSelector')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByTitle('Show Shortcuts')).toBeInTheDocument();
    expect(screen.queryByTestId('topbar-overflow')).toBeNull();
    expect(document.querySelector('.castmill-header')).not.toHaveClass(
      'castmill-header--compact'
    );
  });

  it('shows the menu button next to the icon rail on landscape tablets', () => {
    mockViewport(TABLET_LANDSCAPE);
    withSidePanel();
    renderTopbar();
    const menu = screen.getByTestId('topbar-menu-button');
    expect(menu).toHaveAttribute('aria-controls', 'castmill-sidepanel');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    // Still the full top bar, with the avatar instead of the full name.
    expect(screen.getByTestId('search')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('T');
    expect(screen.queryByText('Test User')).toBeNull();
  });

  it('hides keyboard shortcut UI on touch devices', () => {
    mockViewport(TABLET_LANDSCAPE);
    renderTopbar();
    expect(screen.queryByTitle('Show Shortcuts')).toBeNull();
    expect(screen.queryByText('ShortcutsLegend')).toBeNull();
  });

  it('hides keyboard shortcut UI for a coarse pointer at desktop width', () => {
    mockViewport({ ...DESKTOP, touch: true });
    renderTopbar();
    expect(screen.queryByTitle('Show Shortcuts')).toBeNull();
  });

  it('does not show the menu button without a side panel', () => {
    mockViewport(PHONE);
    renderTopbar();
    expect(screen.queryByTestId('topbar-menu-button')).toBeNull();
  });

  it.each([
    ['phone', PHONE],
    ['portrait tablet', TABLET_PORTRAIT],
  ])('uses the compact bar on a %s', (_, viewport) => {
    mockViewport(viewport);
    withSidePanel();
    renderTopbar();

    expect(document.querySelector('.castmill-header')).toHaveClass(
      'castmill-header--compact'
    );
    expect(screen.getByTestId('topbar-menu-button')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-search-button')).toBeInTheDocument();
    expect(screen.getByText('NotificationBell')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('T');
    expect(screen.getByTestId('user-avatar')).toHaveAttribute(
      'aria-label',
      'Test User'
    );
    // Secondary items moved into the overflow menu.
    expect(screen.queryByTestId('search')).toBeNull();
    expect(screen.queryByText('LanguageSelector')).toBeNull();
    expect(screen.queryByTestId('theme-toggle')).toBeNull();
    expect(screen.queryByText('Help')).toBeNull();
    expect(screen.getByTestId('topbar-overflow')).toBeInTheDocument();
  });

  it('toggles the navigation drawer from the menu button', () => {
    mockViewport(PHONE);
    withSidePanel();
    renderTopbar();
    const menu = screen.getByTestId('topbar-menu-button');
    expect(menu).toHaveAttribute('aria-label', 'topbar.openNavigation');

    fireEvent.click(menu);
    expect(navDrawer.isOpen()).toBe(true);
    expect(menu).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(menu);
    expect(navDrawer.isOpen()).toBe(false);
  });

  it('expands the search icon into a full-width search', () => {
    mockViewport(PHONE);
    renderTopbar();

    fireEvent.click(screen.getByTestId('topbar-search-button'));
    const search = screen.getByTestId('search');
    expect(search).toHaveAttribute('data-autofocus', 'true');
    expect(screen.queryByAltText('Castmill')).toBeNull();

    // Closing via the search itself (submit / Escape).
    fireEvent.click(screen.getByText('search-done'));
    expect(screen.queryByTestId('search')).toBeNull();
    expect(screen.getByAltText('Castmill')).toBeInTheDocument();

    // Closing via the close button.
    fireEvent.click(screen.getByTestId('topbar-search-button'));
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(screen.queryByTestId('search')).toBeNull();
  });

  it('collapses the expanded search when growing to desktop', () => {
    const viewport = mockViewport(PHONE);
    renderTopbar();
    fireEvent.click(screen.getByTestId('topbar-search-button'));
    viewport.resize(DESKTOP);
    expect(screen.getByTestId('search')).toHaveAttribute(
      'data-autofocus',
      'false'
    );
    expect(screen.getByAltText('Castmill')).toBeInTheDocument();
  });

  describe('overflow menu', () => {
    const openMenu = () => {
      const trigger = screen.getByRole('button', {
        name: 'topbar.moreOptions',
      });
      fireEvent.click(trigger);
      return trigger;
    };

    it('holds onboarding, theme, language and help', () => {
      mockViewport(PHONE);
      renderTopbar();
      const trigger = openMenu();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-onboarding', 'getting-started');

      expect(screen.getByText(/topbar\.gettingStarted/)).toBeInTheDocument();
      expect(screen.getByText('topbar.switchToLightMode')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('en');
      expect(screen.getByText('Help').closest('a')).toHaveAttribute(
        'href',
        'https://docs.castmill.io'
      );
      // Touch device: no keyboard shortcuts entry.
      expect(screen.queryByText('Show Shortcuts')).toBeNull();
    });

    it('starts the onboarding tour', () => {
      mockViewport(PHONE);
      renderTopbar();
      openMenu();
      fireEvent.click(screen.getByText(/topbar\.gettingStarted/));
      expect(mockSetStore).toHaveBeenCalledWith('onboarding', 'showTour', true);
      expect(screen.queryByText(/topbar\.gettingStarted/)).toBeNull();
    });

    it('toggles the theme', () => {
      mockViewport(PHONE);
      renderTopbar();
      openMenu();
      fireEvent.click(screen.getByTestId('overflow-theme-toggle'));
      expect(document.documentElement.dataset.theme).toBe('light');
      openMenu();
      expect(screen.getByText('topbar.switchToDarkMode')).toBeInTheDocument();
    });

    it('changes the language', () => {
      mockViewport(PHONE);
      renderTopbar();
      openMenu();
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'ar' },
      });
      expect(mockSetLocale).toHaveBeenCalledWith('ar');
      expect(mockCompleteStep).toHaveBeenCalled();
      expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('opens on the language step of the onboarding tour', () => {
      mockViewport(PHONE);
      renderTopbar();
      // The tour clicks whatever matches the selector.
      const target = document.querySelector<HTMLElement>(
        '[data-onboarding="language-selector"]'
      )!;
      expect(target).toHaveAttribute('data-testid', 'topbar-overflow');
      target.click();
      const select = screen.getByRole('combobox');
      expect(document.activeElement).toBe(select);
      expect(target).not.toHaveAttribute('data-onboarding');
      expect(
        document.querySelector('[data-onboarding="language-selector"]')
      ).toBe(select);
    });

    it('closes on help, outside tap and Escape', () => {
      mockViewport(PHONE);
      renderTopbar();

      openMenu();
      fireEvent.click(screen.getByText('Help'));
      expect(screen.queryByRole('combobox')).toBeNull();

      openMenu();
      fireEvent.pointerDown(screen.getByRole('combobox'));
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole('combobox')).toBeNull();

      const trigger = openMenu();
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('offers the shortcuts legend on narrow non-touch screens', () => {
      mockViewport({ widthEm: 40 });
      renderTopbar();
      openMenu();
      fireEvent.click(screen.getByText('Show Shortcuts'));
      expect(screen.queryByText('Show Shortcuts')).toBeNull();
    });
  });
});
