import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import NetworkPage from './network-page';
import { NetworkService } from '../../services/network.service';

// Mock toast
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
    checkAdminStatus: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getStats: vi.fn(),
    listOrganizations: vi.fn(),
    listUsers: vi.fn(),
    listInvitations: vi.fn(),
    createOrganization: vi.fn(),
  },
}));

// Mock store - must be mutable for tests to change it
let mockStoreState = {
  network: {
    isAdmin: true,
  },
};

vi.mock('../../store', () => ({
  get store() {
    return mockStoreState;
  },
  setStore: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
}));

const mockSettings = {
  id: 'network-123',
  name: 'Test Network',
  domain: 'test.example.com',
  email: 'support@test.com',
  logo: 'https://example.com/logo.png',
  copyright: '© 2025 Test',
  invitation_only: false,
  invitation_only_org_admins: true,
  default_locale: 'en',
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

const mockOrganizations = {
  data: [
    {
      id: 'org-1',
      name: 'Organization 1',
      inserted_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'org-2',
      name: 'Organization 2',
      inserted_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ],
  pagination: {
    page: 1,
    page_size: 10,
    total_count: 2,
    total_pages: 1,
  },
};

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

const renderNetworkPage = () => {
  return render(() => (
    <I18nProvider>
      <NetworkPage />
    </I18nProvider>
  ));
};

describe('NetworkPage', () => {
  beforeEach(() => {
    // Reset store state
    mockStoreState = {
      network: {
        isAdmin: true,
      },
    };

    // Reset mocks
    vi.mocked(NetworkService.getSettings).mockResolvedValue(mockSettings);
    vi.mocked(NetworkService.getStats).mockResolvedValue(mockStats);
    vi.mocked(NetworkService.listOrganizations).mockResolvedValue(
      mockOrganizations
    );
    vi.mocked(NetworkService.listUsers).mockResolvedValue(mockUsers);
    vi.mocked(NetworkService.listInvitations).mockResolvedValue([]);

    toastSpies.success.mockClear();
    toastSpies.error.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Access denied state', () => {
    it('shows access denied for non-admin users', async () => {
      mockStoreState.network = { isAdmin: false };

      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
    });
  });

  describe('Settings tab', () => {
    it('loads and displays network settings', async () => {
      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('support@test.com')
        ).toBeInTheDocument();
      });
    });

    it('displays network statistics', async () => {
      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // organizations_count
        expect(screen.getByText('25')).toBeInTheDocument(); // users_count
        expect(screen.getByText('100')).toBeInTheDocument(); // devices_count
        expect(screen.getByText('10')).toBeInTheDocument(); // teams_count
      });
    });

    it('enables save button when form is modified', async () => {
      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test Network');
      fireEvent.input(nameInput, { target: { value: 'Updated Network' } });

      await waitFor(() => {
        const saveButton = screen.getByText(/save/i);
        expect(saveButton.closest('button')).not.toBeDisabled();
      });
    });

    it('saves settings when save button is clicked', async () => {
      vi.mocked(NetworkService.updateSettings).mockResolvedValue({
        ...mockSettings,
        name: 'Updated Network',
      });

      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test Network');
      fireEvent.input(nameInput, { target: { value: 'Updated Network' } });

      const saveButton = screen.getByText(/save/i).closest('button');
      fireEvent.click(saveButton!);

      await waitFor(() => {
        expect(NetworkService.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Network',
          })
        );
        expect(toastSpies.success).toHaveBeenCalled();
      });
    });
  });

  describe('Organizations tab', () => {
    it('displays list of organizations', async () => {
      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click on Organizations tab - use getAllByText and select the button
      const orgsTabButtons = screen.getAllByText('Organizations');
      const orgsTab = orgsTabButtons.find((el) => el.tagName === 'BUTTON');
      fireEvent.click(orgsTab!);

      await waitFor(() => {
        expect(screen.getByText('Organization 1')).toBeInTheDocument();
        expect(screen.getByText('Organization 2')).toBeInTheDocument();
      });
    });

    it('creates a new organization', async () => {
      const newOrg = {
        id: 'org-new',
        name: 'New Organization',
        inserted_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      };
      vi.mocked(NetworkService.createOrganization).mockResolvedValue(newOrg);

      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click on Organizations tab - use getAllByText and select the button
      const orgsTabButtons = screen.getAllByText('Organizations');
      const orgsTab = orgsTabButtons.find((el) => el.tagName === 'BUTTON');
      fireEvent.click(orgsTab!);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/enter organization name/i)
        ).toBeInTheDocument();
      });

      // Fill in organization name
      const nameInput = screen.getByPlaceholderText(/enter organization name/i);
      fireEvent.input(nameInput, { target: { value: 'New Organization' } });

      // Click create button
      const createButton = screen.getByText(/^create$/i).closest('button');
      fireEvent.click(createButton!);

      await waitFor(() => {
        expect(NetworkService.createOrganization).toHaveBeenCalledWith(
          'New Organization'
        );
        expect(toastSpies.success).toHaveBeenCalled();
      });
    });
  });

  describe('Users tab', () => {
    it('displays list of users', async () => {
      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click on Users tab - use getAllByText and select the button
      const usersTabButtons = screen.getAllByText('Users');
      const usersTab = usersTabButtons.find((el) => el.tagName === 'BUTTON');
      fireEvent.click(usersTab!);

      await waitFor(() => {
        expect(screen.getByText('User 1')).toBeInTheDocument();
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('User 2')).toBeInTheDocument();
        expect(screen.getByText('user2@example.com')).toBeInTheDocument();
      });
    });

    it('shows empty state when no users', async () => {
      vi.mocked(NetworkService.listUsers).mockResolvedValue([]);

      renderNetworkPage();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click on Users tab - use getAllByText and select the button
      const usersTabButtons = screen.getAllByText('Users');
      const usersTab = usersTabButtons.find((el) => el.tagName === 'BUTTON');
      fireEvent.click(usersTab!);

      await waitFor(() => {
        expect(screen.getByText(/no users/i)).toBeInTheDocument();
      });
    });
  });
});
