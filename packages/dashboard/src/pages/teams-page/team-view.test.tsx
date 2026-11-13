import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { I18nProvider } from '../../i18n';
import { TeamView, TeamDetails } from './team-view';
import { TeamsService } from '../../services/teams.service';

const permissions = { allowed: true };

vi.mock('../../services/teams.service', () => ({
  TeamsService: {
    fetchMembers: vi.fn(),
  },
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canPerformAction: () => permissions.allowed,
  }),
}));

vi.mock('./team-resources-view', () => ({
  TeamResourcesView: (props: any) => (
    <div data-testid="team-resources">
      <span>{`resources-${props.teamId}`}</span>
      <button type="button" onClick={() => props.onRemove({ id: 'u1' })}>
        remove-member
      </button>
    </div>
  ),
}));

const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('TeamView', () => {
  beforeEach(() => {
    permissions.allowed = true;
    vi.mocked(TeamsService.fetchMembers).mockResolvedValue({
      count: 3,
      data: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderView = (
    team: TeamDetails,
    onSubmit = vi.fn().mockResolvedValue(undefined)
  ) => {
    const onClose = vi.fn();
    const result = render(() => (
      <I18nProvider>
        <TeamView
          organizationId="org-1"
          team={team}
          title="Team details"
          sessionId={0}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </I18nProvider>
    ));
    return { ...result, onSubmit, onClose };
  };

  const nameInput = () =>
    document.querySelector('input#name') as HTMLInputElement;

  const typeName = (value: string) => {
    fireEvent.input(nameInput(), { target: { value } });
  };

  it('shows a summary card with name, member count and localized timestamps', async () => {
    renderView({
      id: 7,
      name: 'Marketing',
      inserted_at: hourAgo(),
      updated_at: hourAgo(),
    });

    const summary = await screen.findByRole('region', {
      name: 'Team summary',
    });
    expect(summary).toHaveTextContent('Marketing');
    expect(summary).toHaveTextContent(/Created 1 hour ago/);
    expect(summary).toHaveTextContent(/Updated 1 hour ago/);

    await waitFor(() => expect(summary).toHaveTextContent('Members 3'));
    expect(TeamsService.fetchMembers).toHaveBeenCalledWith('org-1', 7, {
      page: { num: 1, size: 1 },
      sortOptions: { direction: 'ascending' },
    });
    expect(screen.getByTestId('team-resources')).toHaveTextContent(
      'resources-7'
    );
  });

  it('accepts camelCase timestamps', async () => {
    renderView({ id: 7, name: 'Marketing', insertedAt: hourAgo() });

    const summary = await screen.findByRole('region', {
      name: 'Team summary',
    });
    expect(summary).toHaveTextContent(/Created 1 hour ago/);
    expect(summary).not.toHaveTextContent(/Updated/);
  });

  it('refreshes the member count when a member is removed', async () => {
    renderView({ id: 7, name: 'Marketing' });
    const summary = await screen.findByRole('region', {
      name: 'Team summary',
    });
    await waitFor(() => expect(summary).toHaveTextContent('Members 3'));

    vi.mocked(TeamsService.fetchMembers).mockResolvedValue({
      count: 2,
      data: [],
    });
    fireEvent.click(screen.getByText('remove-member'));

    await waitFor(() => expect(summary).toHaveTextContent('Members 2'));
  });

  it('keeps the drawer usable when the member count cannot be loaded', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    vi.mocked(TeamsService.fetchMembers).mockRejectedValue(new Error('boom'));

    renderView({ id: 7, name: 'Marketing' });

    const summary = await screen.findByRole('region', {
      name: 'Team summary',
    });
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(summary).not.toHaveTextContent('Members');
    consoleError.mockRestore();
  });

  it('renders a create form without summary or resources for new teams', () => {
    renderView({ name: '' });

    expect(
      screen.queryByRole('region', { name: 'Team summary' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-resources')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(TeamsService.fetchMembers).not.toHaveBeenCalled();
  });

  it('puts Save and Reset in the drawer footer and tracks unsaved changes', async () => {
    renderView({ id: 7, name: 'Marketing' });

    const footer = screen.getByTestId('team-footer');
    const save = screen.getByRole('button', { name: 'Save' });
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(footer).toContainElement(save);
    expect(footer).toContainElement(reset);
    expect(save).toBeDisabled();
    expect(reset).toBeDisabled();
    expect(save).toHaveAttribute('form', nameInput().form!.id);

    typeName('Marketing EU');
    expect(footer).toHaveTextContent('Unsaved changes');
    expect(save).not.toBeDisabled();

    fireEvent.click(reset);
    expect(nameInput().value).toBe('Marketing');
    expect(footer).not.toHaveTextContent('Unsaved changes');
    expect(save).toBeDisabled();
  });

  it('shows localized validation errors', () => {
    renderView({ id: 7, name: 'Marketing' });

    typeName('');
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    typeName('abc');
    expect(
      screen.getByText('Name must be at least 5 characters')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('submits the form from the footer button', async () => {
    const { onSubmit } = renderView(
      { id: 7, name: 'Marketing' },
      vi.fn().mockResolvedValue({ id: 7, name: 'Marketing EU' })
    );

    typeName('Marketing EU');
    fireEvent.submit(nameInput().form!);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ id: 7, name: 'Marketing EU' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('team-footer')).not.toHaveTextContent(
        'Unsaved changes'
      )
    );
  });

  it('keeps unsaved changes after a failed save', async () => {
    const { onSubmit } = renderView(
      { id: 7, name: 'Marketing' },
      vi.fn().mockResolvedValue(false)
    );

    typeName('Marketing EU');
    fireEvent.submit(nameInput().form!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByTestId('team-footer')).toHaveTextContent(
      'Unsaved changes'
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reset' })).not.toBeDisabled()
    );
  });

  it('does not submit an invalid or unchanged form', () => {
    const { onSubmit } = renderView({ id: 7, name: 'Marketing' });

    fireEvent.submit(nameInput().form!);
    typeName('abc');
    fireEvent.submit(nameInput().form!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('hides the footer and disables editing without permission', () => {
    permissions.allowed = false;
    renderView({ id: 7, name: 'Marketing' });

    expect(screen.queryByTestId('team-footer')).not.toBeInTheDocument();
    expect(nameInput()).toBeDisabled();
  });

  it('resets the form and reloads the summary when the team changes', async () => {
    const [team, setTeam] = createSignal<TeamDetails>({
      id: 7,
      name: 'Marketing',
    });
    render(() => (
      <I18nProvider>
        <TeamView
          organizationId="org-1"
          team={team()}
          title="Team"
          sessionId={0}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      </I18nProvider>
    ));

    typeName('Changed name');
    setTeam({ id: 8, name: 'Sales team' });

    expect(nameInput().value).toBe('Sales team');
    await waitFor(() =>
      expect(TeamsService.fetchMembers).toHaveBeenCalledWith(
        'org-1',
        8,
        expect.anything()
      )
    );
    expect(screen.getByTestId('team-footer')).not.toHaveTextContent(
      'Unsaved changes'
    );
  });

  it('ignores a save completion after the drawer session changes', async () => {
    const [team, setTeam] = createSignal<TeamDetails>({
      id: 7,
      name: 'Marketing',
    });
    const [sessionId, setSessionId] = createSignal(0);
    let resolveSave: ((value: any) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<any>((resolve) => {
          resolveSave = resolve;
        })
    );
    render(() => (
      <I18nProvider>
        <TeamView
          organizationId="org-1"
          team={team()}
          title="Team"
          sessionId={sessionId()}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />
      </I18nProvider>
    ));

    typeName('Marketing EU');
    fireEvent.submit(nameInput().form!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    setTeam({ id: 8, name: 'Sales team' });
    setSessionId(1);
    typeName('Sales team EU');
    resolveSave?.({ id: 7, name: 'Marketing EU' });

    await waitFor(() =>
      expect(screen.getByTestId('team-footer')).toHaveTextContent(
        'Unsaved changes'
      )
    );
    expect(screen.getByTestId('team-resources')).toHaveTextContent(
      'resources-8'
    );
  });
});
