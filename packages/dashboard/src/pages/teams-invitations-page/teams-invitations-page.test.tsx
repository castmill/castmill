import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import TeamsInvitationPage from './teams-invitations-page';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '@castmill/ui-common';
import { TeamsService } from '../../services/teams.service';
import { getUser } from '../../components/auth';

vi.mock('../../services/teams.service', () => ({
  TeamsService: {
    getInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
  },
}));

vi.mock('../../components/auth', () => ({
  getUser: vi.fn(() => ({
    id: 'user-1',
    email: 'member@example.com',
  })),
  loginUser: vi.fn(() => Promise.resolve()),
}));

const mockNavigate = vi.fn();

vi.mock('@solidjs/router', async () => {
  const actual =
    await vi.importActual<typeof import('@solidjs/router')>('@solidjs/router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [{ token: 'invite-token-123' }, vi.fn()],
  };
});

describe('TeamsInvitationPage', () => {
  const renderComponent = () =>
    render(() => (
      <I18nProvider>
        <ToastProvider>
          <TeamsInvitationPage />
        </ToastProvider>
      </I18nProvider>
    ));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TeamsService.getInvitation).mockResolvedValue({
      email: 'member@example.com',
      team_id: 'team-1',
      team_name: 'Content Creators',
      organization_id: 'org-123',
      organization_name: 'Acme Inc.',
      status: 'invited',
      expired: false,
      role: 'member',
    });
    vi.mocked(TeamsService.acceptInvitation).mockResolvedValue({});
    vi.mocked(TeamsService.rejectInvitation).mockResolvedValue({});
    mockNavigate.mockClear();
    vi.mocked(getUser).mockReturnValue({
      id: 'user-1',
      email: 'member@example.com',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('redirects to login with token when user is not authenticated', async () => {
    vi.mocked(getUser).mockReturnValueOnce({} as any);

    renderComponent();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?redirectTo=%2Finvite%3Ftoken%3Dinvite-token-123',
        { replace: true }
      );
    });
  });

  it('navigates to the team page after accepting when organization id is present', async () => {
    renderComponent();

    await waitFor(() => {
      expect(TeamsService.getInvitation).toHaveBeenCalledWith(
        'member@example.com',
        'invite-token-123'
      );
    });

    const acceptButton = await screen.findByRole('button', {
      name: /accept/i,
    });

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(TeamsService.acceptInvitation).toHaveBeenCalledWith(
        'member@example.com',
        'invite-token-123'
      );
      expect(mockNavigate).toHaveBeenCalledWith('/org/org-123/teams');
    });
  });

  it('falls back to root navigation when organization id is missing', async () => {
    vi.mocked(TeamsService.getInvitation).mockResolvedValueOnce({
      email: 'member@example.com',
      team_id: 'team-1',
      team_name: 'Content Creators',
      status: 'invited',
      expired: false,
      role: 'admin',
    });

    renderComponent();

    await waitFor(() => {
      expect(TeamsService.getInvitation).toHaveBeenCalled();
    });

    const acceptButton = await screen.findByRole('button', {
      name: /accept/i,
    });

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
