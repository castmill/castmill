import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import NetworkOrganizations from './network-organizations';
import { NetworkService } from '../../services/network.service';
import { OrganizationsService } from '../../services/organizations.service';
import { store, setStore } from '../../store/store';

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
    joinOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    blockOrganization: vi.fn(),
    unblockOrganization: vi.fn(),
    listIntegrationSettings: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../services/organizations.service', () => ({
  OrganizationsService: { getAll: vi.fn() },
}));

vi.mock('../../components/auth', () => ({
  getUser: () => ({ id: 'user-1' }),
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
    setStore('organizations', {
      data: [],
      loaded: true,
      loading: false,
      selectedId: null,
      selectedName: '',
    });
  });

  it('displays list of organizations', async () => {
    renderOrganizations();

    await waitFor(() => {
      expect(screen.getByText('Organization 1')).toBeInTheDocument();
      expect(screen.getByText('Organization 2')).toBeInTheDocument();
    });
  });

  it('opens the integration settings of an organization', async () => {
    renderOrganizations();
    await waitFor(() => screen.getByText('Organization 1'));

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Integration settings Organization 1',
      })
    );
    await waitFor(() =>
      expect(
        screen.getByText('Integration settings – Organization 1')
      ).toBeInTheDocument()
    );
    expect(NetworkService.listIntegrationSettings).toHaveBeenCalledWith(
      'org-1'
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.queryByText('Integration settings – Organization 1')
      ).toBeNull()
    );
  });

  it('blocks through a phone-ready modal with a sticky action row', async () => {
    renderOrganizations();
    await waitFor(() => screen.getByText('Organization 1'));

    fireEvent.click(
      screen.getByRole('button', { name: 'Block Organization 1' })
    );
    await waitFor(() =>
      expect(screen.getByText('Block Organization')).toBeInTheDocument()
    );

    const reason = screen.getByLabelText('Reason (optional)');
    const form = reason.closest('[class*="block-form"]');
    expect(form).not.toBeNull();
    expect(form!.classList.contains('block-form')).toBe(false);

    const actions = form!.querySelector('[data-modal-actions]');
    expect(actions).not.toBeNull();
    expect(actions!.className).toContain('modal-actions');
    expect(actions!.querySelectorAll('button')).toHaveLength(2);
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

    vi.mocked(OrganizationsService.getAll).mockResolvedValue([
      { ...newOrg, created_at: newOrg.inserted_at },
    ]);
    fireEvent.click(createButton!);

    await waitFor(() => {
      expect(NetworkService.createOrganization).toHaveBeenCalledWith(
        'New Organization',
        { join: true }
      );
      expect(toastSpies.success).toHaveBeenCalled();
    });
    expect(OrganizationsService.getAll).toHaveBeenCalledWith('user-1');
    expect(store.organizations.selectedId).toBe('org-new');
    expect(store.organizations.selectedName).toBe('New Organization');
  });

  it('creates an organization without joining it when unchecked', async () => {
    vi.mocked(NetworkService.createOrganization).mockResolvedValue({
      id: 'org-new',
      name: 'New Organization',
      inserted_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    });
    renderOrganizations();
    await waitFor(() => screen.getByText('Organization 1'));

    fireEvent.click(screen.getByLabelText('Add me as an administrator'));
    fireEvent.input(screen.getByPlaceholderText(/enter organization name/i), {
      target: { value: 'New Organization' },
    });
    fireEvent.click(screen.getByText(/^create$/i).closest('button')!);

    await waitFor(() =>
      expect(NetworkService.createOrganization).toHaveBeenCalledWith(
        'New Organization',
        { join: false }
      )
    );
    expect(OrganizationsService.getAll).not.toHaveBeenCalled();
    expect(store.organizations.selectedId).toBeNull();
  });

  it('lets the network admin join organizations they are not in', async () => {
    setStore('organizations', 'data', [
      { ...mockOrganizations.data[0], created_at: '2024-01-01T00:00:00Z' },
    ]);
    vi.mocked(NetworkService.joinOrganization).mockResolvedValue({
      id: 'org-2',
      name: 'Organization 2',
    });
    vi.mocked(OrganizationsService.getAll).mockResolvedValue(
      mockOrganizations.data.map((org) => ({
        ...org,
        created_at: org.inserted_at,
      }))
    );
    renderOrganizations();
    await waitFor(() => screen.getByText('Organization 2'));

    const joinButtons = screen.getAllByRole('button', { name: /^Join / });
    expect(joinButtons).toHaveLength(1);
    fireEvent.click(joinButtons[0]);

    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith(
        'You are now an administrator of Organization 2.'
      )
    );
    expect(NetworkService.joinOrganization).toHaveBeenCalledWith('org-2');
    expect(store.organizations.selectedId).toBe('org-2');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Join / })).toBeNull()
    );
  });

  it('shows why joining an organization failed', async () => {
    vi.mocked(NetworkService.joinOrganization).mockRejectedValue(
      new Error('You are already a member of this organization')
    );
    renderOrganizations();
    await waitFor(() => screen.getByText('Organization 1'));

    fireEvent.click(
      screen.getByRole('button', { name: 'Join Organization 1' })
    );

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'You are already a member of this organization'
      )
    );
    expect(store.organizations.selectedId).toBeNull();
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
