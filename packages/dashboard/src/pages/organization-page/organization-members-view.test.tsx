import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { OrganizationMembersView } from './organization-members-view';
import { OrganizationsService } from '../../services/organizations.service';
import { getUser } from '../../components/auth';

const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../services/organizations.service', () => ({
  OrganizationsService: {
    fetchMembers: vi.fn(),
    removeMemberFromOrganization: vi.fn(),
    inviteUser: vi.fn(),
  },
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canPerformAction: () => true,
  }),
}));

vi.mock('../../components/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => toastSpies,
  };
});

describe('OrganizationMembersView - leave organization', () => {
  beforeEach(() => {
    toastSpies.success.mockClear();
    toastSpies.error.mockClear();
    vi.mocked(OrganizationsService.fetchMembers).mockClear();
    vi.mocked(
      OrganizationsService.removeMemberFromOrganization
    ).mockResolvedValue(undefined);
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
        <OrganizationMembersView
          organizationId="org-1"
          organizationName="Test Organization"
          onRemove={vi.fn()}
        />
      </I18nProvider>
    ));

  it('allows a member to leave when another admin exists', async () => {
    vi.mocked(OrganizationsService.fetchMembers).mockResolvedValue({
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
      name: /leave organization/i,
    });

    expect(leaveButton).not.toBeDisabled();

    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(
        OrganizationsService.removeMemberFromOrganization
      ).toHaveBeenCalledWith('org-1', 'user-1');
    });

    await waitFor(() => {
      expect(toastSpies.success).toHaveBeenCalled();
    });
  });

  it('allows an admin to leave when another admin exists', async () => {
    vi.mocked(OrganizationsService.fetchMembers).mockResolvedValue({
      count: 2,
      data: [
        {
          user: { id: 'user-1', name: 'Alice', email: 'admin1@example.com' },
          user_id: 'user-1',
          role: 'admin',
        },
        {
          user: { id: 'user-2', name: 'Bob', email: 'admin2@example.com' },
          user_id: 'user-2',
          role: 'admin',
        },
      ],
    });

    renderComponent();

    const leaveButton = await screen.findByRole('button', {
      name: /leave organization/i,
    });

    expect(leaveButton).not.toBeDisabled();
  });

  it('disables the leave button when user is the last admin', async () => {
    vi.mocked(OrganizationsService.fetchMembers).mockResolvedValue({
      count: 2,
      data: [
        {
          user: { id: 'user-1', name: 'Alice', email: 'admin@example.com' },
          user_id: 'user-1',
          role: 'admin',
        },
        {
          user: { id: 'user-2', name: 'Bob', email: 'member@example.com' },
          user_id: 'user-2',
          role: 'member',
        },
      ],
    });

    renderComponent();

    const leaveButton = await screen.findByRole('button', {
      name: /leave organization/i,
    });

    await waitFor(() => {
      expect(leaveButton).toBeDisabled();
    });
    expect(
      await screen.findByText(/add another admin before leaving/i)
    ).toBeInTheDocument();
  });

  it('disables the leave button when user is the only member', async () => {
    vi.mocked(OrganizationsService.fetchMembers).mockResolvedValue({
      count: 1,
      data: [
        {
          user: { id: 'user-1', name: 'Alice', email: 'admin@example.com' },
          user_id: 'user-1',
          role: 'admin',
        },
      ],
    });

    renderComponent();

    const leaveButton = await screen.findByRole('button', {
      name: /leave organization/i,
    });

    await waitFor(() => {
      expect(leaveButton).toBeDisabled();
    });
    expect(
      await screen.findByText(/you cannot leave as you are the only member/i)
    ).toBeInTheDocument();
  });

  it('does not show leave button for non-members', async () => {
    vi.mocked(getUser).mockReturnValue({
      id: 'user-3',
      name: 'Charlie',
      email: 'other@example.com',
    });

    vi.mocked(OrganizationsService.fetchMembers).mockResolvedValue({
      count: 2,
      data: [
        {
          user: { id: 'user-1', name: 'Alice', email: 'admin@example.com' },
          user_id: 'user-1',
          role: 'admin',
        },
        {
          user: { id: 'user-2', name: 'Bob', email: 'member@example.com' },
          user_id: 'user-2',
          role: 'member',
        },
      ],
    });

    renderComponent();

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /leave organization/i })
      ).not.toBeInTheDocument();
    });
  });
});
