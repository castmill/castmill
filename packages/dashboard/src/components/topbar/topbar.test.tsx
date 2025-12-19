import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import Topbar from './topbar';

// Mock the auth module
vi.mock('../auth', () => ({
  checkAuth: () => true,
  getUser: () => ({ name: 'Test User', email: 'test@example.com' }),
  resetSession: vi.fn(),
}));

// Mock router
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock the search component
vi.mock('../search/search', () => ({
  default: () => <div>Search</div>,
}));

// Mock the notification bell
vi.mock('../notification-bell/notification-bell', () => ({
  default: () => <div>NotificationBell</div>,
}));

// Mock dropdown menu
vi.mock('../dropdown-menu/dropdown-menu', () => ({
  default: ({ children }: { children: any }) => <div>{children}</div>,
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
vi.mock('../../i18n', () => ({
  useI18n: () => ({
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
vi.mock('../../store/store', () => ({
  store: {
    loadingAddons: false,
    organizations: {
      selectedName: 'Test Org',
    },
  },
}));

// Mock the logo import
vi.mock('../../assets/castmill-logo-topbar.png', () => ({
  default: 'logo.png',
}));

describe('Topbar Component', () => {
  beforeEach(() => {
    // Mock fetch for logout
    global.fetch = vi.fn();
  });

  it('renders the Help button with correct attributes', () => {
    render(() => <Topbar />);

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
});
