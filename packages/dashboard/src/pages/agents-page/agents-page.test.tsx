import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import AgentsPage from './agents-page';
import { AgentsService } from '../../services/agents.service';
import { setStore } from '../../store/store';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
let role = 'admin';

vi.mock('../../services/agents.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/agents.service')>();
  return {
    ...actual,
    AgentsService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      rotateCredentials: vi.fn(),
      revokeCredentials: vi.fn(),
      listActions: vi.fn(),
    },
  };
});

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasRole: (r: string) => r === role,
    hasAnyRole: (roles: string[]) => roles.includes(role),
  }),
}));

vi.mock('../../store/store', async () => {
  const { createStore } = await import('solid-js/store');
  const [store, setStore] = createStore({
    organizations: { selectedId: 'org-1' },
  });
  return { store, setStore };
});

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => toastSpies };
});

const agent = {
  id: 'agent-1',
  name: 'Menu bot',
  description: 'Updates menus',
  role: 'editor' as const,
  user_id: 'user-1',
  organization_id: 'org-1',
  has_credentials: true,
  secret_prefix: 'cmagt_abcd',
  last_used_at: null,
  last_ip: null,
  inserted_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const renderPage = () =>
  render(() => (
    <I18nProvider>
      <AgentsPage />
    </I18nProvider>
  ));

describe('AgentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role = 'admin';
    setStore('organizations', 'selectedId', 'org-1');
    vi.mocked(AgentsService.list).mockResolvedValue([agent]);
    vi.mocked(AgentsService.listActions).mockResolvedValue({
      data: [],
      count: 0,
    });
  });

  it('lists the agents of the organization', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Menu bot')).toBeTruthy());
    expect(AgentsService.list).toHaveBeenCalledWith('org-1');
    expect(screen.getByText('Updates menus')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
    expect(screen.getByText('cmagt_abcd…')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
  });

  it('resets the activity log filters when the organization changes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Menu bot')).toBeTruthy());

    fireEvent.click(screen.getByText('Activity log'));
    await waitFor(() =>
      expect(AgentsService.listActions).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ status: undefined })
      )
    );

    fireEvent.change(document.querySelectorAll('select')[1], {
      target: { value: 'error' },
    });
    await waitFor(() =>
      expect(AgentsService.listActions).toHaveBeenLastCalledWith(
        'org-1',
        expect.objectContaining({ status: 'error' })
      )
    );

    setStore('organizations', 'selectedId', 'org-2');

    await waitFor(() =>
      expect(AgentsService.listActions).toHaveBeenLastCalledWith('org-2', {
        agentId: undefined,
        status: undefined,
        page: 1,
        pageSize: 25,
      })
    );
    expect(AgentsService.listActions).not.toHaveBeenCalledWith(
      'org-2',
      expect.objectContaining({ status: 'error' })
    );
  });

  it('shows an empty state', async () => {
    vi.mocked(AgentsService.list).mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByText(/No agents yet/)).toBeTruthy());
  });

  it('denies access to roles other than admin and manager', () => {
    role = 'member';
    renderPage();

    expect(screen.getByTestId('agents-no-access')).toBeTruthy();
    expect(AgentsService.list).not.toHaveBeenCalled();
  });

  it('managers can view but not manage agents', async () => {
    role = 'manager';
    renderPage();

    await waitFor(() => expect(screen.getByText('Menu bot')).toBeTruthy());
    expect(screen.queryByText('New agent')).toBeNull();
    expect(screen.queryByTitle('Rotate credentials')).toBeNull();
  });

  it('creates an agent and shows the secret once', async () => {
    vi.mocked(AgentsService.create).mockResolvedValue({
      data: agent,
      secret: 'cmagt_the_secret',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Menu bot')).toBeTruthy());

    fireEvent.click(screen.getByText('New agent'));
    const nameInput = document.getElementById('agent-name') as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Menu bot' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() =>
      expect(AgentsService.create).toHaveBeenCalledWith('org-1', {
        name: 'Menu bot',
        description: '',
        role: 'member',
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId('agent-secret').textContent).toBe(
        'cmagt_the_secret'
      )
    );
    expect(toastSpies.success).toHaveBeenCalled();

    fireEvent.click(screen.getByText('I have saved the secret'));
    await waitFor(() =>
      expect(screen.queryByTestId('agent-secret')).toBeNull()
    );
  });

  it('rotates credentials after confirmation', async () => {
    vi.mocked(AgentsService.rotateCredentials).mockResolvedValue({
      data: agent,
      secret: 'cmagt_rotated',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Menu bot')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Rotate credentials'));
    await waitFor(() =>
      expect(screen.getByText(/current secret stops working/)).toBeTruthy()
    );
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() =>
      expect(AgentsService.rotateCredentials).toHaveBeenCalledWith(
        'org-1',
        'agent-1'
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId('agent-secret').textContent).toBe(
        'cmagt_rotated'
      )
    );
  });

  it('revokes credentials and deletes agents', async () => {
    vi.mocked(AgentsService.revokeCredentials).mockResolvedValue({
      ...agent,
      has_credentials: false,
    });
    vi.mocked(AgentsService.remove).mockResolvedValue();
    renderPage();
    await waitFor(() => expect(screen.getByText('Menu bot')).toBeTruthy());

    fireEvent.click(screen.getByTitle('Revoke credentials'));
    fireEvent.click(await screen.findByText('Confirm'));
    await waitFor(() =>
      expect(AgentsService.revokeCredentials).toHaveBeenCalledWith(
        'org-1',
        'agent-1'
      )
    );

    fireEvent.click(screen.getByTitle('Delete'));
    fireEvent.click(await screen.findByText('Confirm'));
    await waitFor(() =>
      expect(AgentsService.remove).toHaveBeenCalledWith('org-1', 'agent-1')
    );
  });

  it('shows an error toast when loading fails', async () => {
    vi.mocked(AgentsService.list).mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith('Failed to load agents')
    );
  });
});
