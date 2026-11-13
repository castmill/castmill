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
    vi.mocked(NetworkService.listUsers).mockResolvedValue({
      data: mockUsers,
      pagination: { page: 1, page_size: 20, total_count: 2, total_pages: 1 },
    });
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

  it('labels every user cell with its column for the phone card layout', async () => {
    renderUsers();
    await waitFor(() => expect(screen.getByText('User 1')).toBeInTheDocument());

    const table = screen.getAllByRole('table')[0];
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent
    );
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const labels = Array.from(row.querySelectorAll('td')).map((td) =>
        td.getAttribute('data-label')
      );
      expect(labels).toEqual(headers);
    }
  });

  it('shows empty state when no users', async () => {
    vi.mocked(NetworkService.listUsers).mockResolvedValue({
      data: [],
      pagination: { page: 1, page_size: 20, total_count: 0, total_pages: 0 },
    });

    renderUsers();

    await waitFor(() => {
      expect(screen.getByText(/no users/i)).toBeInTheDocument();
    });
  });

  it('labels every invitation cell with its column', async () => {
    vi.mocked(NetworkService.listInvitations).mockResolvedValue([
      {
        id: 'inv-1',
        email: 'invitee@example.com',
        role: 'member',
        organization_id: 'org-1',
        organization_name: 'Acme',
        status: 'invited',
        inserted_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-08T00:00:00Z',
      },
    ]);
    renderUsers();
    await waitFor(() =>
      expect(screen.getByText('invitee@example.com')).toBeInTheDocument()
    );

    const row = screen.getByText('invitee@example.com').closest('tr')!;
    const table = row.closest('table')!;
    const headers = Array.from(table.querySelectorAll('thead th')).map(
      (th) => th.textContent
    );
    expect(headers).toHaveLength(7);
    expect(
      Array.from(row.querySelectorAll('td')).map((td) =>
        td.getAttribute('data-label')
      )
    ).toEqual(headers);
  });

  it('loads invitations on mount', async () => {
    renderUsers();

    await waitFor(() => {
      expect(NetworkService.listInvitations).toHaveBeenCalled();
    });
  });
});
