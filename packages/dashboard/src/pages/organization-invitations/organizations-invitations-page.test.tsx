import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import OrganizationsInvitationPage from './organizations-invitations-page';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '@castmill/ui-common';

// Mock services
vi.mock('../../services/organizations.service', () => ({
  OrganizationsService: {
    previewInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  },
}));

// Mock auth functions
vi.mock('../../components/auth', () => ({
  checkAuth: vi.fn(() => false),
  getUser: vi.fn(() => null),
  loginUser: vi.fn(() => Promise.resolve()),
}));

// Mock navigator
vi.mock('../../components/utils', () => ({
  arrayBufferToBase64: vi.fn((buffer) => 'base64-encoded-string'),
  base64URLToArrayBuffer: vi.fn((str) => new ArrayBuffer(32)),
}));

// Mock environment variables
vi.mock('../../env', () => ({
  baseUrl: 'http://localhost:4000',
  domain: 'localhost',
  origin: 'http://localhost:3000',
}));

const mockNavigate = vi.fn();
vi.mock('@solidjs/router', async () => {
  const actual = await vi.importActual('@solidjs/router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [{ token: 'test-token-123' }, vi.fn()],
  };
});

describe('OrganizationsInvitationPage', () => {
  const mockInvitation = {
    email: 'newuser@example.com',
    organization_name: 'Test Organization',
    organization_id: '123',
    status: 'invited',
    expires_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    user_exists: false,
    expired: false,
  };

  const mockExistingUserInvitation = {
    ...mockInvitation,
    email: 'existing@example.com',
    user_exists: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderComponent = () => {
    return render(() => (
      <I18nProvider>
        <ToastProvider>
          <OrganizationsInvitationPage />
        </ToastProvider>
      </I18nProvider>
    ));
  };

  describe('Loading and Preview', () => {
    it('shows loading state initially', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderComponent();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays invitation details for new user', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockInvitation
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/You've been invited to join/i)
        ).toBeInTheDocument();
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
        expect(
          screen.getByText(/Create your account to accept this invitation/i)
        ).toBeInTheDocument();
        expect(screen.getByText('Sign Up with Passkey')).toBeInTheDocument();
      });
    });

    it('displays invitation details for existing user', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockExistingUserInvitation
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/Login to accept this invitation/i)
        ).toBeInTheDocument();
        expect(screen.getByText('Login with Passkey')).toBeInTheDocument();
      });
    });

    it('shows error message when invitation is invalid', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockRejectedValue(
        new Error('Invalid invitation')
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Invalid invitation')).toBeInTheDocument();
      });
    });

    it('shows expired state when invitation is expired', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue({
        ...mockInvitation,
        expired: true,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/This invitation has expired/i)
        ).toBeInTheDocument();
      });
    });

    it('shows already accepted state when invitation status is not invited', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue({
        ...mockInvitation,
        status: 'accepted',
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/This invitation has already been accepted/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Signup Flow', () => {
    it('initiates signup with passkey when clicking Sign Up button', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockInvitation
      );

      const mockCredential = {
        id: 'credential-id',
        rawId: new ArrayBuffer(32),
        response: {
          getPublicKey: () => new ArrayBuffer(64),
          clientDataJSON: new TextEncoder().encode(
            JSON.stringify({
              type: 'webauthn.create',
              origin: 'http://localhost:3000',
            })
          ),
        },
        type: 'public-key',
      };

      vi.stubGlobal('navigator', {
        credentials: {
          create: vi.fn().mockResolvedValue(mockCredential),
        },
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ signup_id: '123', challenge: 'abc123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      vi.mocked(OrganizationsService.acceptInvitation).mockResolvedValue({});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Sign Up with Passkey')).toBeInTheDocument();
      });

      const signupButton = screen.getByText('Sign Up with Passkey');
      fireEvent.click(signupButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4000/signups/challenges',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              email: 'newuser@example.com',
              invitation_token: 'test-token-123',
            }),
          })
        );
      });

      await waitFor(() => {
        expect(global.navigator.credentials.create).toHaveBeenCalled();
      });
    });

    it('shows error when signup challenge request fails', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockInvitation
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server error',
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Sign Up with Passkey')).toBeInTheDocument();
      });

      const signupButton = screen.getByText('Sign Up with Passkey');
      fireEvent.click(signupButton);

      await waitFor(() => {
        expect(screen.getByText('Creating account...')).toBeInTheDocument();
      });

      // Should show error and revert button text
      await waitFor(() => {
        expect(screen.getByText('Sign Up with Passkey')).toBeInTheDocument();
      });
    });

    it('disables signup button while signing up', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockInvitation
      );

      global.fetch = vi.fn(
        () => new Promise(() => {}) // Never resolves
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Sign Up with Passkey')).toBeInTheDocument();
      });

      const signupButton = screen.getByText('Sign Up with Passkey');
      fireEvent.click(signupButton);

      await waitFor(() => {
        const button = screen.getByText('Creating account...');
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Login Flow', () => {
    it('authenticates existing users with passkey directly', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      const { loginUser } = await import('../../components/auth');

      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockExistingUserInvitation
      );

      const authenticatorData = new Uint8Array([1, 2, 3]).buffer;
      const signature = new Uint8Array([4, 5, 6]).buffer;

      vi.stubGlobal('navigator', {
        credentials: {
          get: vi.fn().mockResolvedValue({
            id: 'credential-id',
            rawId: new ArrayBuffer(32),
            response: {
              authenticatorData,
              signature,
              clientDataJSON: new TextEncoder().encode('client-data'),
            },
            type: 'public-key',
          }),
        },
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ challenge: 'abc123' }),
        })
        .mockResolvedValueOnce({ ok: true });

      renderComponent();

      const loginButton = await screen.findByText('Login with Passkey');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4000/sessions/challenges',
          expect.objectContaining({ credentials: 'include' })
        );
      });

      await waitFor(() => {
        expect((navigator as any).credentials.get).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:4000/sessions/',
          expect.objectContaining({ method: 'POST' })
        );
      });

      await waitFor(() => {
        expect(loginUser).toHaveBeenCalled();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated User Flow', () => {
    it('shows accept button for authenticated user', async () => {
      const { checkAuth, getUser } = await import('../../components/auth');
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );

      vi.mocked(checkAuth).mockReturnValue(true);
      vi.mocked(getUser).mockReturnValue({
        email: 'existing@example.com',
        id: '123',
      } as any);

      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockExistingUserInvitation
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/Accept/i) || screen.getByRole('button')
        ).toBeInTheDocument();
      });
    });

    it('calls acceptInvitation when authenticated user clicks accept', async () => {
      const { checkAuth, getUser } = await import('../../components/auth');
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );

      vi.mocked(checkAuth).mockReturnValue(true);
      vi.mocked(getUser).mockReturnValue({
        email: 'existing@example.com',
        id: '123',
      } as any);

      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockExistingUserInvitation
      );

      vi.mocked(OrganizationsService.acceptInvitation).mockResolvedValue({});

      renderComponent();

      await waitFor(() => {
        const acceptButton = screen.getByRole('button');
        expect(acceptButton).toBeInTheDocument();
      });

      const acceptButton = screen.getByRole('button');
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(OrganizationsService.acceptInvitation).toHaveBeenCalledWith(
          'test-token-123'
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/org/123/organization');
      });
    });
  });

  describe('Email Display', () => {
    it('displays email address in styled box', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockInvitation
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Email Address')).toBeInTheDocument();
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
      });

      // Check that email is in the email-box container
      const emailBox = screen
        .getByText('newuser@example.com')
        .closest('.email-box');
      expect(emailBox).toBeInTheDocument();
    });
  });

  describe('Organization Information', () => {
    it('displays organization name prominently', async () => {
      const { OrganizationsService } = await import(
        '../../services/organizations.service'
      );
      vi.mocked(OrganizationsService.previewInvitation).mockResolvedValue(
        mockInvitation
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument();
        expect(
          screen.getByText(/You've been invited to join/i)
        ).toBeInTheDocument();
      });
    });
  });
});
