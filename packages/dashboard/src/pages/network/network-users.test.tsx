import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import NetworkUsers from './network-users';
import { NetworkService } from '../../services/network.service';

// Toast spies
const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => toastSpies,
  };
});

vi.mock('../../services/network.service', () => ({
  NetworkService: {
    listUsers: vi.fn(),
    listInvitations: vi.fn(),
    listOrganizations: vi.fn(),
    inviteUser: vi.fn(),
    deleteUser: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    deleteInvitation: vi.fn(),
  },
}));

const mockStats = {
  organizations_count: 5,
  users_count: 25,
  devices_count: 100,
  teams_count: 10,
  total_storage_bytes: 1073741824,
};

vi.mock('./network-context', () => ({
  useNetworkContext: () => ({
    settings: () => null,
    setSettings: vi.fn(),
    stats: () => mockStats,
    setStats: vi.fn(),
    loading: () => false,
    error: () => null,
    reload: vi.fn(),
  }),
}));

const mockUsers = [
  {
    id: 'user-1',
    name: 'User 1',
    email: 'user1@example.com',
    inserted_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'User 2',
    email: 'user2@example.com',
    inserted_at: '2024-01-02T00:00:00Z',
  },
];

const renderUsers = () =>
  render(() => (
    <I18nProvider>
      <NetworkUsers />
    </I18nProvider>
  ));

describe('NetworkUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NetworkService.listUsers).mockResolvedValue(mockUsers);
    vi.mocked(NetworkService.listInvitations).mockResolvedValue([]);
    vi.mocked(NetworkService.listOrganizations).mockResolvedValue({
      data: [],
      pagination: { page: 1, page_size: 100, total_count: 0, total_pages: 0 },
    });
  });

  it('displays list of users', async () => {
    renderUsers();

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      expect(screen.getByText('User 2')).toBeInTheDocument();
      expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    });
  });

  it('shows empty state when no users', async () => {
    vi.mocked(NetworkService.listUsers).mockResolvedValue([]);

    renderUsers();

    await waitFor(() => {
      expect(screen.getByText(/no users/i)).toBeInTheDocument();
    });
  });

  it('loads invitations on mount', async () => {
    renderUsers();

    await waitFor(() => {
      expect(NetworkService.listInvitations).toHaveBeenCalled();
    });
  });
});
