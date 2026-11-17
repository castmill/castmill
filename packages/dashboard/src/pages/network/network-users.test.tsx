import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
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
    makeNetworkAdmin: vi.fn(),
    removeNetworkAdmin: vi.fn(),
  },
}));

vi.mock('../../components/auth', () => ({
  getUser: () => ({ id: 'me' }),
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

  it('loads invitations on mount', async () => {
    renderUsers();

    await waitFor(() => {
      expect(NetworkService.listInvitations).toHaveBeenCalled();
    });
  });

  describe('network admin roles', () => {
    const roleUsers = [
      {
        id: 'me',
        name: 'Me Admin',
        email: 'me@example.com',
        role: 'admin' as const,
        inserted_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'admin-2',
        name: 'Other Admin',
        email: 'other@example.com',
        role: 'admin' as const,
        inserted_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'member-1',
        name: 'Plain Member',
        email: 'member@example.com',
        role: 'member' as const,
        inserted_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'blocked-1',
        name: 'Blocked Member',
        email: 'blocked@example.com',
        role: 'member' as const,
        blocked_at: '2024-02-01T00:00:00Z',
        inserted_at: '2024-01-01T00:00:00Z',
      },
    ];

    const row = (name: string) => screen.getByText(name).closest('tr')!;

    beforeEach(() => {
      vi.mocked(NetworkService.listUsers).mockResolvedValue({
        data: roleUsers,
        pagination: { page: 1, page_size: 20, total_count: 4, total_pages: 1 },
      });
    });

    it('shows each user’s network role and only the actions that apply', async () => {
      renderUsers();
      await waitFor(() => screen.getByText('Plain Member'));

      expect(
        within(row('Me Admin')).getByText('Network admin')
      ).toBeInTheDocument();
      expect(
        within(row('Plain Member')).getByText('Member')
      ).toBeInTheDocument();

      // Yourself: no way to remove your own admin role, block or delete yourself.
      expect(within(row('Me Admin')).queryAllByRole('button')).toHaveLength(0);

      // Other admins can lose the admin role but are never blocked or deleted.
      const other = within(row('Other Admin'));
      expect(other.getByTitle('Remove network admin')).toBeInTheDocument();
      expect(other.queryByTitle('Block')).toBeNull();
      expect(other.queryByTitle('Delete')).toBeNull();

      const member = within(row('Plain Member'));
      expect(member.getByTitle('Make network admin')).toBeInTheDocument();
      expect(member.getByTitle('Block')).toBeInTheDocument();
      expect(member.getByTitle('Delete')).toBeInTheDocument();

      // Blocked users must be unblocked before they can become admins.
      const blocked = within(row('Blocked Member'));
      expect(blocked.queryByTitle('Make network admin')).toBeNull();
      expect(blocked.getByTitle('Unblock')).toBeInTheDocument();
    });

    it('makes a member a network admin after confirmation', async () => {
      vi.mocked(NetworkService.makeNetworkAdmin).mockResolvedValue({
        success: true,
        user: { ...roleUsers[2], role: 'admin' },
      });
      renderUsers();
      await waitFor(() => screen.getByText('Plain Member'));

      fireEvent.click(
        within(row('Plain Member')).getByTitle('Make network admin')
      );
      expect(
        await screen.findByText(/Make "Plain Member" a network admin\?/)
      ).toBeInTheDocument();
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith(
          'Plain Member is now a network admin'
        )
      );
      expect(NetworkService.makeNetworkAdmin).toHaveBeenCalledWith('member-1');
      expect(
        within(row('Plain Member')).getByText('Network admin')
      ).toBeInTheDocument();
      expect(within(row('Plain Member')).queryByTitle('Block')).toBeNull();
    });

    it('removes another admin’s network admin role after confirmation', async () => {
      vi.mocked(NetworkService.removeNetworkAdmin).mockResolvedValue({
        success: true,
        user: { ...roleUsers[1], role: 'member' },
      });
      renderUsers();
      await waitFor(() => screen.getByText('Other Admin'));

      fireEvent.click(
        within(row('Other Admin')).getByTitle('Remove network admin')
      );
      expect(
        await screen.findByText(/Remove "Other Admin" as a network admin\?/)
      ).toBeInTheDocument();
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith(
          'Other Admin is no longer a network admin'
        )
      );
      expect(NetworkService.removeNetworkAdmin).toHaveBeenCalledWith('admin-2');
      expect(
        within(row('Other Admin')).getByText('Member')
      ).toBeInTheDocument();
      expect(
        within(row('Other Admin')).getByTitle('Block')
      ).toBeInTheDocument();
    });

    it('shows why a role change failed and keeps the role', async () => {
      vi.mocked(NetworkService.makeNetworkAdmin).mockRejectedValue(
        new Error('Unblock this user before making them a network admin')
      );
      renderUsers();
      await waitFor(() => screen.getByText('Plain Member'));

      fireEvent.click(
        within(row('Plain Member')).getByTitle('Make network admin')
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith(
          'Unblock this user before making them a network admin'
        )
      );
      expect(
        within(row('Plain Member')).getByText('Member')
      ).toBeInTheDocument();
    });
  });
});
