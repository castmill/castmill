import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import NetworkOverview from './network-overview';

const mockSettings = {
  id: 'network-123',
  name: 'Test Network',
  domain: 'test.example.com',
  email: 'support@test.com',
  logo: null,
  copyright: '© 2025 Test',
  invitation_only: false,
  invitation_only_org_admins: true,
  default_locale: 'en',
  privacy_policy_url: null,
  meta: {},
  inserted_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockStats = {
  organizations_count: 5,
  users_count: 25,
  devices_count: 100,
  teams_count: 10,
  total_storage_bytes: 1073741824,
};

// Mock the context to provide pre-loaded data directly
vi.mock('./network-context', () => ({
  useNetworkContext: () => ({
    settings: () => mockSettings,
    setSettings: vi.fn(),
    stats: () => mockStats,
    setStats: vi.fn(),
    loading: () => false,
    error: () => null,
    reload: vi.fn(),
  }),
}));

const renderOverview = () =>
  render(() => (
    <I18nProvider>
      <NetworkOverview />
    </I18nProvider>
  ));

describe('NetworkOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays network statistics', async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // organizations_count
      expect(screen.getByText('25')).toBeInTheDocument(); // users_count
      expect(screen.getByText('100')).toBeInTheDocument(); // devices_count
      expect(screen.getByText('10')).toBeInTheDocument(); // teams_count
    });
  });

  it('displays network name and domain', async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText('Test Network')).toBeInTheDocument();
      expect(screen.getByText('test.example.com')).toBeInTheDocument();
    });
  });

  it('displays storage in human-readable format', async () => {
    renderOverview();

    await waitFor(() => {
      // 1073741824 bytes = 1 GB
      expect(screen.getByText('1 GB')).toBeInTheDocument();
    });
  });

  it('displays email', async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText('support@test.com')).toBeInTheDocument();
    });
  });
});
