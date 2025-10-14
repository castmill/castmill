import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { TeamMembersView } from './team-members-view';
import { TeamsService } from '../../services/teams.service';
import { OrganizationsService } from '../../services/organizations.service';
import { getUser } from '../../components/auth';

const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../services/teams.service', () => ({
  TeamsService: {
    fetchMembers: vi.fn(),
    removeMemberFromTeam: vi.fn(),
    inviteUser: vi.fn(),
  },
}));

vi.mock('../../services/organizations.service', () => ({
  OrganizationsService: {
    fetchMembers: vi.fn(() => ({
      count: 0,
      data: [],
    })),
  },
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canPerformAction: () => true,
  }),
}));

vi.mock('../../components/auth', () => ({
  getUser: vi.fn(() => ({
    id: 'user-1',
    name: 'Alice',
    email: 'member@example.com',
  })),
}));

vi.mock('@castmill/ui-common', async () => {
  const { onMount } =
    await vi.importActual<typeof import('solid-js')>('solid-js');
  const defaultOptions = {
    page: { num: 1, size: 10 },
    sortOptions: { key: 'name', direction: 'ascending' },
    search: '',
    filters: {},
  } as any;

  const TableView = (props: any) => {
    onMount(() => {
      props.ref?.({
        reloadData: () => props.fetchData(defaultOptions),
      });
      props.fetchData(defaultOptions);
    });

    return (
      <div>
        <div>{props.toolbar?.mainAction}</div>
        <div>{props.toolbar?.actions}</div>
        <div>{props.children}</div>
      </div>
    );
  };

  const Button = (props: any) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.label || props.children}
    </button>
  );

  return {
    Button,
    IconButton: Button,
    Modal: (props: any) => <div>{props.children}</div>,
    ConfirmDialog: (props: any) =>
      props.show ? (
        <div>
          <button onClick={props.onConfirm}>confirm</button>
          <button onClick={props.onClose}>close</button>
          {props.children}
        </div>
      ) : null,
    ComboBox: () => <div />,
    Dropdown: (props: any) => (
      <select
        onChange={(event) => props.onSelectChange?.(event.currentTarget.value)}
        value={props.defaultValue}
      >
        {props.items.map((item: any) => (
          <option value={item.value}>{item.name}</option>
        ))}
      </select>
    ),
    Timestamp: (props: any) => <span>{props.value}</span>,
    TableView,
    ToastProvider: (props: any) => <div>{props.children}</div>,
    useToast: () => toastSpies,
  };
});

describe('TeamMembersView - leave team', () => {
  beforeEach(() => {
    toastSpies.success.mockClear();
    toastSpies.error.mockClear();
    vi.mocked(TeamsService.fetchMembers).mockClear();
    vi.mocked(TeamsService.removeMemberFromTeam).mockResolvedValue(undefined);
    vi.mocked(OrganizationsService.fetchMembers).mockClear();
    vi.mocked(getUser).mockReturnValue({
      id: 'user-1',
      name: 'Alice',
      email: 'member@example.com',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(() => (
      <I18nProvider>
        <TeamMembersView
          organizationId="org-1"
          teamId={42}
          onRemove={vi.fn()}
        />
      </I18nProvider>
    ));

  it('allows a member to leave when another admin exists', async () => {
    vi.mocked(TeamsService.fetchMembers).mockResolvedValue({
      count: 2,
      data: [
        {
          user: { id: 'user-1', name: 'Alice', email: 'member@example.com' },
          user_id: 'user-1',
          role: 'member',
        },
        {
          user: { id: 'user-2', name: 'Bob', email: 'admin@example.com' },
          user_id: 'user-2',
          role: 'admin',
        },
      ],
    });

    renderComponent();

    const leaveButton = await screen.findByRole('button', {
      name: /leave team/i,
    });

    expect(leaveButton).not.toBeDisabled();

    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(TeamsService.removeMemberFromTeam).toHaveBeenCalledWith(
        'org-1',
        42,
        'user-1'
      );
    });

    await waitFor(() => {
      expect(toastSpies.success).toHaveBeenCalled();
    });
  });

  it('disables the leave button when user is the last admin', async () => {
    vi.mocked(TeamsService.fetchMembers).mockResolvedValue({
      count: 1,
      data: [
        {
          user: { id: 'user-1', name: 'Alice', email: 'member@example.com' },
          user_id: 'user-1',
          role: 'admin',
        },
      ],
    });

    renderComponent();

    const leaveButton = await screen.findByRole('button', {
      name: /leave team/i,
    });

    await waitFor(() => {
      expect(leaveButton).toBeDisabled();
    });
    expect(
      await screen.findByText(/add another admin before leaving/i)
    ).toBeInTheDocument();
  });
});
