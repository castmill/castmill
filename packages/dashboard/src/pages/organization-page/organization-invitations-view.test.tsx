import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { HttpError } from '@castmill/ui-common';
import { I18nProvider } from '../../i18n';
import { OrganizationInvitationsView } from './organization-invitations-view';
import { OrganizationsService } from '../../services/organizations.service';

const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../services/organizations.service', () => ({
  OrganizationsService: {
    fetchInvitations: vi.fn(),
    resendInvitation: vi.fn(),
    removeInvitationFromOrganization: vi.fn(),
  },
}));

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => toastSpies,
  };
});

const invitations = [
  {
    id: 1,
    email: 'pending@example.com',
    status: 'invited',
    role: 'member',
    inserted_at: '2026-01-01T10:00:00Z',
    expires_at: '2026-01-08T10:00:00Z',
  },
  {
    id: 2,
    email: 'accepted@example.com',
    status: 'accepted',
    role: 'editor',
    inserted_at: '2026-01-01T10:00:00Z',
    expires_at: '2026-01-08T10:00:00Z',
  },
];

describe('OrganizationInvitationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OrganizationsService.fetchInvitations).mockResolvedValue({
      data: invitations,
      count: invitations.length,
    });
    vi.mocked(OrganizationsService.resendInvitation).mockResolvedValue({
      id: 1,
      email: 'pending@example.com',
      status: 'invited',
      expires_at: '2026-01-15T10:00:00Z',
    });
    vi.mocked(
      OrganizationsService.removeInvitationFromOrganization
    ).mockResolvedValue(undefined);
  });

  const renderView = () =>
    render(() => (
      <I18nProvider>
        <OrganizationInvitationsView
          organizationId="org-1"
          onRemove={vi.fn()}
        />
      </I18nProvider>
    ));

  const openResendDialog = async () => {
    renderView();
    const [resendButton] = await screen.findAllByRole('button', {
      name: 'Resend invitation',
    });
    fireEvent.click(resendButton);
    return screen.findByText(
      'Send the invitation to "pending@example.com" again? It will be valid for 7 more days, and the link in earlier invitation emails will stop working.'
    );
  };

  it('offers resend only for invitations that were not accepted', async () => {
    renderView();

    await screen.findByText('accepted@example.com');
    expect(
      screen.getAllByRole('button', { name: 'Resend invitation' })
    ).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('resends the invitation after confirmation and reloads the list', async () => {
    await openResendDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() =>
      expect(OrganizationsService.resendInvitation).toHaveBeenCalledWith(
        'org-1',
        1
      )
    );
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith(
        'Invitation sent again to pending@example.com'
      )
    );
    await waitFor(() =>
      expect(OrganizationsService.fetchInvitations).toHaveBeenCalledTimes(2)
    );
    expect(screen.queryByText(/It will be valid for 7 more days/)).toBeNull();
  });

  it('does not resend when the dialog is cancelled', async () => {
    await openResendDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByText(/It will be valid for 7 more days/)).toBeNull()
    );
    expect(OrganizationsService.resendInvitation).not.toHaveBeenCalled();
  });

  it.each([
    ['already_accepted', 'This invitation has already been accepted.'],
    [
      'already_member',
      'pending@example.com is already a member of this organization.',
    ],
    [
      'already_invited',
      'A newer invitation for pending@example.com is pending. Resend that one instead.',
    ],
    ['Internal Server Error', 'Failed to resend the invitation'],
  ])('explains why %s invitations cannot be resent', async (code, message) => {
    vi.mocked(OrganizationsService.resendInvitation).mockRejectedValue(
      new HttpError(code, code === 'Internal Server Error' ? 500 : 409)
    );
    await openResendDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(toastSpies.error).toHaveBeenCalledWith(message));
    expect(toastSpies.success).not.toHaveBeenCalled();
  });

  it('reloads the renewed invitation when its email could not be sent', async () => {
    vi.mocked(OrganizationsService.resendInvitation).mockRejectedValue(
      new HttpError('invitation_email_not_sent', 502)
    );
    await openResendDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'The invitation for pending@example.com has a new link, but its email could not be sent. Resend it again.'
      )
    );
    await waitFor(() =>
      expect(OrganizationsService.fetchInvitations).toHaveBeenCalledTimes(2)
    );
    expect(screen.queryByText(/It will be valid for 7 more days/)).toBeNull();
  });

  it('removes the selected invitations by their id', async () => {
    renderView();

    fireEvent.click(await screen.findByLabelText('Select row 1'));
    const removeSelected = await waitFor(() => {
      const button = document.querySelector('.selection-action-btn.danger');
      expect(button).not.toBeNull();
      return button as HTMLElement;
    });
    fireEvent.click(removeSelected);
    await screen.findByText(
      'Are you sure you want to remove the following invitations?'
    );

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() =>
      expect(
        OrganizationsService.removeInvitationFromOrganization
      ).toHaveBeenCalledWith('org-1', 1)
    );
    expect(
      OrganizationsService.removeInvitationFromOrganization
    ).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith('Invitations removed')
    );
    expect(document.querySelector('.selection-action-btn.danger')).toBeNull();
  });

  it('keeps selected invitation details when changing pages', async () => {
    vi.mocked(OrganizationsService.fetchInvitations).mockImplementation(
      async (_organizationId, options) => ({
        data:
          options.page.num === 1
            ? invitations
            : [
                {
                  ...invitations[0],
                  id: 11,
                  email: 'page-two@example.com',
                },
              ],
        count: 20,
      })
    );

    renderView();
    fireEvent.click(await screen.findByLabelText('Select row 1'));
    fireEvent.click(screen.getByLabelText('Next page'));

    await waitFor(() =>
      expect(OrganizationsService.fetchInvitations).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ page: expect.objectContaining({ num: 2 }) })
      )
    );

    const removeSelected = document.querySelector(
      '.selection-action-btn.danger'
    ) as HTMLElement;
    fireEvent.click(removeSelected);

    await screen.findByText(
      'Are you sure you want to remove the following invitations?'
    );
    expect(document.body.textContent).toContain('- pending@example.com');
    expect(document.body.textContent).not.toContain('- undefined');
  });

  it('clears the selection after removing a selected invitation individually', async () => {
    renderView();
    fireEvent.click(await screen.findByLabelText('Select row 1'));

    const rowRemove = screen.getAllByRole('button', { name: 'Remove' })[0];
    fireEvent.click(rowRemove);
    await screen.findByText(
      'Are you sure you want to remove the invitation for "pending@example.com"?'
    );

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() =>
      expect(
        OrganizationsService.removeInvitationFromOrganization
      ).toHaveBeenCalledWith('org-1', 1)
    );
    await waitFor(() =>
      expect(document.querySelector('.selection-action-btn.danger')).toBeNull()
    );
  });

  it('waits for all bulk removals and refreshes after partial failure', async () => {
    vi.mocked(
      OrganizationsService.removeInvitationFromOrganization
    ).mockImplementation(async (_organizationId, invitationId) => {
      if (invitationId === 2) {
        throw new Error('Failed to remove invitation');
      }
    });

    renderView();
    fireEvent.click(await screen.findByLabelText('Select row 1'));
    fireEvent.click(screen.getByLabelText('Select row 2'));

    const removeSelected = document.querySelector(
      '.selection-action-btn.danger'
    ) as HTMLElement;
    fireEvent.click(removeSelected);

    await screen.findByText(
      'Are you sure you want to remove the following invitations?'
    );
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() =>
      expect(
        OrganizationsService.removeInvitationFromOrganization
      ).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(OrganizationsService.fetchInvitations).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Failed to remove the invitation'
      )
    );
    expect(document.querySelector('.selection-action-btn.danger')).toBeNull();
  });
});
