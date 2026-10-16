import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { AgentActivityLog } from './agent-activity-log';
import { AgentsService } from '../../services/agents.service';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock('../../services/agents.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/agents.service')>();
  return { ...actual, AgentsService: { listActions: vi.fn() } };
});

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => toastSpies };
});

const actions = [
  {
    id: 2,
    agent_id: 'agent-1',
    agent_name: 'Menu bot',
    tool: 'delete_resource',
    arguments: { resource_type: 'playlists', id: 5 },
    method: 'DELETE',
    path: '/dashboard/organizations/org-1/playlists/5',
    status: 'error' as const,
    http_status: 403,
    error: 'Request failed with HTTP status 403',
    duration_ms: 12,
    ip: '10.0.0.1',
    inserted_at: '2026-01-01T10:00:00',
  },
  {
    id: 1,
    agent_id: 'agent-1',
    agent_name: 'Menu bot',
    tool: 'list_resources',
    arguments: {},
    method: 'GET',
    path: '/dashboard/organizations/org-1/playlists',
    status: 'success' as const,
    http_status: 200,
    error: null,
    duration_ms: 8,
    ip: null,
    inserted_at: '2026-01-01T09:00:00',
  },
];

const renderLog = () =>
  render(() => (
    <I18nProvider>
      <AgentActivityLog
        organizationId="org-1"
        agents={[
          {
            id: 'agent-1',
            name: 'Menu bot',
            role: 'editor',
            user_id: 'u',
            organization_id: 'org-1',
            has_credentials: true,
            inserted_at: '',
            updated_at: '',
          },
        ]}
      />
    </I18nProvider>
  ));

describe('AgentActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the actions of the agents', async () => {
    vi.mocked(AgentsService.listActions).mockResolvedValue({
      data: actions,
      count: 2,
    });
    renderLog();

    await waitFor(() =>
      expect(screen.getByText('delete_resource')).toBeTruthy()
    );
    expect(AgentsService.listActions).toHaveBeenCalledWith('org-1', {
      agentId: undefined,
      status: undefined,
      page: 1,
      pageSize: 25,
    });
    expect(screen.getByText('list_resources')).toBeTruthy();
    expect(screen.getByText('12 ms')).toBeTruthy();
    expect(screen.getByText(/\(403\)/)).toBeTruthy();
  });

  it('expands an action to show its arguments and error', async () => {
    vi.mocked(AgentsService.listActions).mockResolvedValue({
      data: actions,
      count: 2,
    });
    renderLog();

    const disclosure = await screen.findByRole('button', {
      name: 'delete_resource',
    });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');

    await waitFor(() =>
      expect(
        screen.getByText('Request failed with HTTP status 403')
      ).toBeTruthy()
    );
    expect(screen.getByText(/"resource_type": "playlists"/)).toBeTruthy();
    expect(screen.getByText(/10\.0\.0\.1/)).toBeTruthy();
  });

  it('filters by status', async () => {
    vi.mocked(AgentsService.listActions).mockResolvedValue({
      data: [],
      count: 0,
    });
    renderLog();

    await waitFor(() =>
      expect(screen.getByText('No agent activity yet.')).toBeTruthy()
    );

    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[1], { target: { value: 'error' } });

    await waitFor(() =>
      expect(AgentsService.listActions).toHaveBeenLastCalledWith('org-1', {
        agentId: undefined,
        status: 'error',
        page: 1,
        pageSize: 25,
      })
    );
  });

  it('shows an error toast when loading fails', async () => {
    vi.mocked(AgentsService.listActions).mockRejectedValue(new Error('x'));
    renderLog();

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Failed to load the activity log'
      )
    );
  });

  it('ignores results from an earlier filter request', async () => {
    let resolveFirst!: (result: { data: typeof actions; count: number }) => void;
    vi.mocked(AgentsService.listActions)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ data: [], count: 0 });
    renderLog();

    await waitFor(() =>
      expect(AgentsService.listActions).toHaveBeenCalledTimes(1)
    );
    fireEvent.change(document.querySelectorAll('select')[1], {
      target: { value: 'error' },
    });
    await waitFor(() =>
      expect(AgentsService.listActions).toHaveBeenCalledTimes(2)
    );
    resolveFirst({ data: actions, count: actions.length });

    await waitFor(() =>
      expect(screen.getByText('No agent activity yet.')).toBeTruthy()
    );
    expect(screen.queryByText('delete_resource')).toBeNull();
  });
});
