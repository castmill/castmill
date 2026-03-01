import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import NetworkOrganizations from './network-organizations';
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
    listOrganizations: vi.fn(),
    createOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    blockOrganization: vi.fn(),
    unblockOrganization: vi.fn(),
  },
}));

const mockStats = {
  organizations_count: 5,
  users_count: 25,
  devices_count: 100,
  teams_count: 10,
  total_storage_bytes: 1073741824,
};

const mockSetStats = vi.fn();

vi.mock('./network-context', () => ({
  useNetworkContext: () => ({
    settings: () => null,
    setSettings: vi.fn(),
    stats: () => mockStats,
    setStats: mockSetStats,
    loading: () => false,
    error: () => null,
    reload: vi.fn(),
  }),
}));

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

const renderOrganizations = () =>
  render(() => (
    <I18nProvider>
      <NetworkOrganizations />
    </I18nProvider>
  ));

describe('NetworkOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NetworkService.listOrganizations).mockResolvedValue(
      mockOrganizations
    );
  });

  it('displays list of organizations', async () => {
    renderOrganizations();

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

    renderOrganizations();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/enter organization name/i)
      ).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/enter organization name/i);
    fireEvent.input(nameInput, { target: { value: 'New Organization' } });

    const createButton = screen.getByText(/^create$/i).closest('button');
    fireEvent.click(createButton!);

    await waitFor(() => {
      expect(NetworkService.createOrganization).toHaveBeenCalledWith(
        'New Organization'
      );
      expect(toastSpies.success).toHaveBeenCalled();
    });
  });

  it('shows empty state when no organizations', async () => {
    vi.mocked(NetworkService.listOrganizations).mockResolvedValue({
      data: [],
      pagination: { page: 1, page_size: 10, total_count: 0, total_pages: 0 },
    });

    renderOrganizations();

    await waitFor(() => {
      expect(screen.getByText(/no organizations/i)).toBeInTheDocument();
    });
  });
});
