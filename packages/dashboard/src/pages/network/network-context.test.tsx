import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { NetworkProvider, useNetworkContext } from './network-context';
import { NetworkService } from '../../services/network.service';
import { Component } from 'solid-js';

vi.mock('../../services/network.service', () => ({
  NetworkService: {
    getSettings: vi.fn(),
    getStats: vi.fn(),
  },
}));

let mockStoreState = { network: { isAdmin: true } };

vi.mock('../../store', () => ({
  get store() {
    return mockStoreState;
  },
  setStore: vi.fn(),
}));

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

// Helper component that consumes context and shows it
const ContextConsumer: Component = () => {
  const { settings, stats, loading, error } = useNetworkContext();
  return (
    <div>
      <span data-testid="loading">{String(loading())}</span>
      <span data-testid="error">{error() ?? 'none'}</span>
      <span data-testid="name">{settings()?.name ?? ''}</span>
      <span data-testid="users">{stats()?.users_count ?? ''}</span>
    </div>
  );
};

const renderProvider = () =>
  render(() => (
    <I18nProvider>
      <NetworkProvider>
        <ContextConsumer />
      </NetworkProvider>
    </I18nProvider>
  ));

describe('NetworkProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = { network: { isAdmin: true } };
  });

  it('loads settings and stats for admin users', async () => {
    vi.mocked(NetworkService.getSettings).mockResolvedValue(mockSettings);
    vi.mocked(NetworkService.getStats).mockResolvedValue(mockStats);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Test Network');
      expect(screen.getByTestId('users').textContent).toBe('25');
    });
  });

  it('shows access denied for non-admin users', async () => {
    mockStoreState = { network: { isAdmin: false } };

    renderProvider();

    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });

    expect(NetworkService.getSettings).not.toHaveBeenCalled();
  });

  it('shows error state when API fails', async () => {
    vi.mocked(NetworkService.getSettings).mockRejectedValue(
      new Error('Network error')
    );
    vi.mocked(NetworkService.getStats).mockRejectedValue(
      new Error('Network error')
    );

    renderProvider();

    // The provider renders its own error UI (not the children)
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
