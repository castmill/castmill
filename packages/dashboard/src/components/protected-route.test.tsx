import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@solidjs/testing-library';
import { buildRedirectUrl } from './protected-route';
import ProtectedRoute from './protected-route';

// ----- module mocks -----

const mockLoginUser = vi.fn();
const mockGetUser = vi.fn();
const mockCheckAuth = vi.fn();

vi.mock('./auth', () => ({
  checkAuth: () => mockCheckAuth(),
  getUser: () => mockGetUser(),
  loginUser: () => mockLoginUser(),
}));

const mockNavigate = vi.fn();

vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/org/org-1/devices', search: '' }),
  useParams: () => ({ orgId: 'org-1' }),
}));

vi.mock('../store/store', () => ({
  store: {
    organizations: {
      data: [],
      loaded: false,
      loading: false,
      selectedId: null,
      selectedName: null,
    },
    addons: [],
    loadedAddons: false,
    loadingAddons: false,
    network: { loaded: false, loading: false },
    networkSettings: { loaded: false, loading: false },
    onboarding: { showTour: false, progress: null },
  },
  setStore: vi.fn(),
}));

vi.mock('../services/organizations.service', () => ({
  OrganizationsService: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/network.service', () => ({
  NetworkService: {
    checkAdminStatus: vi.fn().mockResolvedValue({ is_admin: false }),
    getPublicSettings: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/onboarding.service', () => ({
  OnboardingService: {
    getProgress: vi.fn().mockResolvedValue({
      completed_steps: [],
      is_completed: false,
      dismissed: false,
    }),
  },
}));

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ loadPermissions: vi.fn() }),
}));

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: () => 'en',
    extendTranslations: vi.fn(),
  }),
}));

vi.mock('@castmill/ui-common', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock('./server-error/server-error', () => ({
  ServerError: () => null,
}));

vi.mock('./onboarding-dialog/onboarding-dialog', () => ({
  OnboardingDialog: () => null,
}));

vi.mock('./onboarding-tour/onboarding-tour', () => ({
  OnboardingTour: () => null,
}));

vi.mock('../env', () => ({
  baseUrl: 'http://localhost:4000',
  wsEndpoint: 'ws://localhost:4000',
}));

// ----- tests -----

describe('buildRedirectUrl', () => {
  it('returns login url with encoded pathname when not root', () => {
    expect(buildRedirectUrl('/invite', '')).toBe('/login?redirectTo=%2Finvite');
  });

  it('preserves query parameters when provided', () => {
    expect(buildRedirectUrl('/invite', '?token=abc123')).toBe(
      '/login?redirectTo=%2Finvite%3Ftoken%3Dabc123'
    );
  });

  it('redirects to bare login when destination is root', () => {
    expect(buildRedirectUrl('/', '')).toBe('/login');
  });
});

describe('ProtectedRoute auth-guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAuth.mockReturnValue(true);
    mockLoginUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('skips loginUser() when user is already loaded', async () => {
    mockGetUser.mockReturnValue({ id: 'user-123', email: 'test@example.com' });

    render(() => ProtectedRoute({ children: (_addons) => <></> }));

    // Allow onMount to complete
    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it('calls loginUser() when user is not yet loaded', async () => {
    // No id → user not loaded (page refresh scenario)
    mockGetUser.mockReturnValue({});

    render(() => ProtectedRoute({ children: (_addons) => <></> }));

    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledTimes(1);
    });
  });
});
