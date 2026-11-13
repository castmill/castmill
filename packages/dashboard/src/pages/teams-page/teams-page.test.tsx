import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import TeamsPage from './teams-page';
import { TeamsService } from '../../services/teams.service';

const toastSpies = { success: vi.fn(), error: vi.fn() };
const setSearchParams = vi.fn();
const teamViewProps: any[] = [];
const tableRef = { reloadData: vi.fn(), updateItem: vi.fn() };

vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [{}, setSearchParams],
  useLocation: () => ({ pathname: '/org/org-1/teams' }),
}));

vi.mock('../../store/store', () => ({
  store: { organizations: { selectedId: 'org-1' } },
}));

vi.mock('../../services/teams.service', () => ({
  TeamsService: {
    fetchTeams: vi.fn(),
    addTeam: vi.fn(),
    updateTeam: vi.fn(),
    removeTeam: vi.fn(),
  },
}));

vi.mock('../../services/quotas.service', () => ({
  QuotasService: {
    getResourceQuota: vi.fn().mockResolvedValue({ used: 1, total: 5 }),
  },
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canPerformAction: () => true }),
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    registerShortcutAction: vi.fn(),
    unregisterShortcutAction: vi.fn(),
  }),
}));

vi.mock('../../hooks/useModalFromUrl', () => ({
  useModalFromUrl: vi.fn(),
}));

vi.mock('../../components/quota-indicator', () => ({
  QuotaIndicator: (props: any) => (
    <span data-testid="quota">{props.resourceName}</span>
  ),
}));

vi.mock('../../components/permission-button/permission-button', () => ({
  PermissionButton: (props: any) => (
    <button onClick={props.onClick}>{props.label()}</button>
  ),
}));

vi.mock('./team-view', () => ({
  TeamView: (props: any) => {
    teamViewProps.push(props);
    return (
      <div data-testid="team-view">
        <span>{props.title}</span>
        <span data-testid="team-updated">{props.team.updated_at ?? ''}</span>
        <button onClick={props.onClose}>close-drawer</button>
      </div>
    );
  },
}));

vi.mock('@castmill/ui-common', () => ({
  TableView: (props: any) => {
    props.ref?.(tableRef);
    return (
      <div>
        {props.toolbar?.mainAction}
        {props.table.actions.map((action: any) => (
          <button onClick={() => action.handler({ id: 3, name: 'Marketing' })}>
            {action.label()}
          </button>
        ))}
      </div>
    );
  },
  ConfirmDialog: (props: any) => (
    <>
      {props.show ? (
        <div>
          <span>{props.title}</span>
          <button onClick={props.onConfirm}>confirm</button>
        </div>
      ) : null}
    </>
  ),
  Button: () => null,
  IconButton: () => null,
  useToast: () => toastSpies,
}));

const latestTeamView = () => teamViewProps[teamViewProps.length - 1];

describe('TeamsPage', () => {
  beforeEach(() => {
    teamViewProps.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(() => (
      <I18nProvider>
        <TeamsPage />
      </I18nProvider>
    ));

  it('localizes the quota label', async () => {
    renderPage();
    expect(await screen.findByTestId('quota')).toHaveTextContent('Teams');
  });

  it('creates a team with a localized toast and keeps its timestamps', async () => {
    vi.mocked(TeamsService.addTeam).mockResolvedValue({
      id: 9,
      name: 'Design team',
      members: [],
      organization_id: 'org-1',
      inserted_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    });
    renderPage();

    fireEvent.click(screen.getByText('Add Team'));
    expect(screen.getByTestId('team-view')).toHaveTextContent('New Team');

    const result = await latestTeamView().onSubmit({ name: 'Design team' });

    expect(result.id).toBe(9);
    expect(TeamsService.addTeam).toHaveBeenCalledWith('org-1', 'Design team');
    expect(toastSpies.success).toHaveBeenCalledWith(
      'Team Design team created successfully'
    );
    expect(tableRef.reloadData).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('team-view')).toHaveTextContent(
        'Team "Design team"'
      )
    );
    expect(screen.getByTestId('team-updated')).toHaveTextContent(
      '2026-01-02T00:00:00Z'
    );
  });

  it('updates a team with a localized toast and refreshes its summary', async () => {
    vi.mocked(TeamsService.updateTeam).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(screen.getByText('View'));
    await latestTeamView().onSubmit({ id: 3, name: 'Marketing EU' });

    expect(TeamsService.updateTeam).toHaveBeenCalledWith('org-1', {
      id: 3,
      name: 'Marketing EU',
    });
    expect(tableRef.updateItem).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        id: 3,
        name: 'Marketing EU',
        updated_at: expect.any(String),
      })
    );
    expect(toastSpies.success).toHaveBeenCalledWith(
      'Team Marketing EU updated successfully'
    );
    await waitFor(() =>
      expect(screen.getByTestId('team-updated').textContent).not.toBe('')
    );
    expect(screen.getByTestId('team-updated')).toHaveTextContent(
      tableRef.updateItem.mock.calls[0][1].updated_at
    );
    expect(screen.getByTestId('team-view')).toHaveTextContent(
      'Team "Marketing EU"'
    );
  });

  it('shows a localized error when saving fails', async () => {
    vi.mocked(TeamsService.updateTeam).mockRejectedValue(new Error('nope'));
    renderPage();

    fireEvent.click(screen.getByText('View'));
    const result = await latestTeamView().onSubmit({
      id: 3,
      name: 'Marketing EU',
    });

    expect(result).toBe(false);
    expect(toastSpies.error).toHaveBeenCalledWith(
      'Error saving team: Error: nope'
    );
  });

  it('does not replace a new-team form when an older save completes', async () => {
    let resolveUpdate: (() => void) | undefined;
    vi.mocked(TeamsService.updateTeam).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );
    renderPage();

    fireEvent.click(screen.getByText('View'));
    const save = latestTeamView().onSubmit({
      id: 3,
      name: 'Marketing EU',
    });
    fireEvent.click(screen.getByText('Add Team'));
    resolveUpdate?.();
    await save;

    expect(latestTeamView().team.id).toBeUndefined();
    expect(latestTeamView().team.name).toBe('');
    expect(tableRef.updateItem).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        name: 'Marketing EU',
        updated_at: expect.any(String),
      })
    );
  });

  it('removes a team with a localized toast', async () => {
    vi.mocked(TeamsService.removeTeam).mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(screen.getByText('Remove'));
    fireEvent.click(screen.getByText('confirm'));

    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith(
        'Team Marketing removed successfully'
      )
    );
    expect(TeamsService.removeTeam).toHaveBeenCalledWith('org-1', 3);
  });

  it('closes the drawer and clears the item id', () => {
    renderPage();

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('close-drawer'));

    expect(screen.queryByTestId('team-view')).not.toBeInTheDocument();
    expect(setSearchParams).toHaveBeenCalledWith({ itemId: undefined });
  });
});
