import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import { checkAuth, getUser, loginUser } from '../../components/auth';
import { OrganizationsService } from '../../services/organizations.service';
import { useI18n } from '../../i18n';
import {
  arrayBufferToBase64,
  base64URLToArrayBuffer,
} from '../../components/utils';
import { baseUrl, domain, origin } from '../../env';
import { useToast } from '@castmill/ui-common';

import './organizations-invitations-page.scss';

interface Invitation {
  email: string;
  organization_id: string;
  organization_name: string;
  status: string; // "invited", "expired", etc.
  expires_at?: string;
  user_exists: boolean; // Does user with this email already exist?
  expired: boolean;
}

const OrganizationsInvitationPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [invitation, setInvitation] = createSignal<Invitation | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [loading, setLoading] = createSignal<boolean>(true);
  const [signingUp, setSigningUp] = createSignal<boolean>(false);
  const [loggingIn, setLoggingIn] = createSignal<boolean>(false);
  const [accepting, setAccepting] = createSignal<boolean>(false);
  const [rejecting, setRejecting] = createSignal<boolean>(false);

  const encoder = new TextEncoder();

  // 1. Read the token from the query param
  const token = searchParams.token || '';

  // 2. Preview invitation details (no auth required - checks if user exists)
  async function previewInvitation() {
    if (!token) {
      setErrorMessage('No invitation token provided.');
      setLoading(false);
      return;
    }

    try {
      const result = await OrganizationsService.previewInvitation(token);
      setInvitation(result);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error loading invitation.');
    } finally {
      setLoading(false);
    }
  }

  // 3. Sign up with passkey directly (for new users)
  async function signupWithPasskey() {
    if (!invitation() || invitation()!.user_exists) {
      return;
    }

    setSigningUp(true);

    try {
      // Get challenge from server for new signup
      const challengeResponse = await fetch(`${baseUrl}/signups/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitation()!.email,
          invitation_token: token,
        }),
        credentials: 'include',
      });

      if (!challengeResponse.ok) {
        throw new Error('Failed to get signup challenge');
      }

      const { signup_id, challenge } = await challengeResponse.json();

      // Create passkey
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          rp: {
            id: domain,
            name: 'Castmill AB',
          },
          user: {
            id: encoder.encode(signup_id),
            name: invitation()!.email,
            displayName: invitation()!.email,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -8 },
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          challenge: base64URLToArrayBuffer(challenge),
          authenticatorSelection: {
            userVerification: 'required',
            requireResidentKey: true,
          },
        },
      };

      const credential = await navigator.credentials.create(createOptions);
      if (!credential) {
        throw new Error('Could not create credential');
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const authAttestationResponse =
        publicKeyCredential.response as AuthenticatorAttestationResponse;
      const publicKey = authAttestationResponse.getPublicKey();
      if (!publicKey) {
        throw new Error('Could not get public key');
      }

      const clientDataJSON = new TextDecoder().decode(
        authAttestationResponse.clientDataJSON
      );

      // Create user account
      const signupResponse = await fetch(
        `${baseUrl}/signups/${signup_id}/users`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: invitation()!.email,
            challenge,
            credential_id: credential.id,
            public_key_spki: arrayBufferToBase64(publicKey),
            raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
            client_data_json: clientDataJSON,
            invitation_token: token,
          }),
          credentials: 'include',
        }
      );

      if (!signupResponse.ok) {
        throw new Error('Signup failed');
      }

      toast.success('Account created successfully!');

      // Login the user
      await loginUser();

      // Auto-accept invitation since user signed up specifically for this invitation
      await acceptInvitation();
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setSigningUp(false);
    }
  }

  async function loginExistingUserWithPasskey() {
    if (!invitation()?.user_exists || loggingIn()) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.credentials ||
      typeof navigator.credentials.get !== 'function'
    ) {
      toast.error('Passkeys are not supported in this browser');
      return;
    }

    setLoggingIn(true);

    try {
      const challengeResponse = await fetch(`${baseUrl}/sessions/challenges`, {
        credentials: 'include',
      });

      if (!challengeResponse.ok) {
        throw new Error('Failed to get login challenge');
      }

      const { challenge } = await challengeResponse.json();

      const credential = await navigator.credentials.get({
        publicKey: {
          rpId: domain,
          challenge: base64URLToArrayBuffer(challenge),
        },
      });

      if (!credential) {
        throw new Error('No credentials available for this passkey');
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const assertionResponse =
        publicKeyCredential.response as AuthenticatorAssertionResponse;
      const clientDataJSON = new TextDecoder().decode(
        assertionResponse.clientDataJSON
      );

      const loginResponse = await fetch(`${baseUrl}/sessions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_id: publicKeyCredential.id,
          raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
          client_data_json: clientDataJSON,
          authenticator_data: arrayBufferToBase64(
            assertionResponse.authenticatorData
          ),
          signature: arrayBufferToBase64(assertionResponse.signature),
          email: invitation()!.email,
          challenge,
        }),
        credentials: 'include',
      });

      if (!loginResponse.ok) {
        throw new Error('Failed to authenticate');
      }

      await loginUser();
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error?.message || 'Failed to authenticate');
    } finally {
      setLoggingIn(false);
    }
  }

  // 4. Accept the invitation
  async function acceptInvitation() {
    setAccepting(true);
    try {
      const result = await OrganizationsService.acceptInvitation(token);

      console.log(result);
      toast.success(t('common.acceptInvitation'));

      // Redirect to the organization that the user was invited to
      const orgId = invitation()?.organization_id;
      if (orgId) {
        navigate(`/org/${orgId}/organization`);
      } else {
        // Fallback to root if no org ID (shouldn't happen)
        navigate(`/`);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Error accepting invitation.');
      toast.error(error.message || 'Error accepting invitation.');
    } finally {
      setAccepting(false);
    }
  }

  // 5. Reject the invitation
  async function rejectInvitation() {
    setRejecting(true);
    try {
      await OrganizationsService.rejectInvitation(token);
      toast.success('Invitation rejected successfully');

      // Redirect to root or login page
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Error rejecting invitation.');
    } finally {
      setRejecting(false);
    }
  }

  // 6. On mount, preview invitation first (no auth needed)
  onMount(async () => {
    await previewInvitation();

    // If already authenticated and invitation is valid, user can proceed
    // Otherwise, they need to login/signup based on user_exists flag
  });

  return (
    <div class="castmill-invitation">
      <div class="invitation-container">
        <Show when={loading()}>
          <div class="invitation-box">
            <div class="flex items-center justify-center mb-4">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
            <p class="text-gray-600">{t('common.loadingInvitation')}</p>
          </div>
        </Show>

        <Show when={!loading() && errorMessage()}>
          <div class="invitation-box">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                class="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-800 mb-2">Error</h2>
            <p class="text-red-600">{errorMessage()}</p>
          </div>
        </Show>

        <Show when={!loading() && invitation()}>
          <div class="invitation-box">
            {/* Header with icon */}
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  class="w-8 h-8 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 class="text-2xl font-bold mb-2">
                {t('organizations.invitation.title')}
              </h2>
              <p class="text-gray-600">
                You've been invited to join{' '}
                <span class="font-semibold text-indigo-600">
                  {invitation()?.organization_name}
                </span>
              </p>
            </div>

            {/* Email display */}
            <div class="email-box">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.invitation.emailAddress')}
              </label>
              <div class="flex items-center gap-2">
                <svg
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
                <span class="font-medium">{invitation()?.email}</span>
              </div>
            </div>

            {/* Error states */}
            <Show when={invitation()?.expired}>
              <div class="alert-box alert-error">
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>{t('organizations.invitation.expired')}</p>
              </div>
            </Show>

            <Show when={invitation()?.status !== 'invited'}>
              <div class="alert-box alert-warning">
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p>This invitation has already been {invitation()?.status}.</p>
              </div>
            </Show>

            <Show
              when={
                !invitation()?.expired && invitation()?.status === 'invited'
              }
            >
              {/* Logged in state - show accept and reject buttons */}
              <Show when={checkAuth() && getUser()?.email}>
                <div class="action-buttons">
                  <button
                    onClick={acceptInvitation}
                    disabled={accepting() || rejecting()}
                    class="btn-accept"
                  >
                    <Show
                      when={!accepting()}
                      fallback={<span>{t('common.loading')}</span>}
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{t('common.acceptInvitation')}</span>
                    </Show>
                  </button>

                  <button
                    onClick={rejectInvitation}
                    disabled={accepting() || rejecting()}
                    class="btn-reject"
                  >
                    <Show
                      when={!rejecting()}
                      fallback={
                        <span>{t('organizations.invitation.rejecting')}</span>
                      }
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span>{t('organizations.invitation.reject')}</span>
                    </Show>
                  </button>
                </div>
              </Show>

              {/* Not logged in - show login or signup */}
              <Show when={!checkAuth() || !getUser()?.email}>
                <Show when={invitation()?.user_exists}>
                  {/* Existing user - login */}
                  <p class="text-center text-gray-600 mb-4">
                    {t('organizations.invitation.loginToAccept')}
                  </p>
                  <button
                    onClick={loginExistingUserWithPasskey}
                    disabled={loggingIn()}
                    class="invitation-button"
                  >
                    {loggingIn()
                      ? t('login.loading')
                      : t('login.loginWithPasskey')}
                  </button>
                </Show>

                <Show when={!invitation()?.user_exists}>
                  {/* New user - signup with passkey directly */}
                  <p class="text-center text-gray-600 mb-4">
                    {t('organizations.invitation.createAccount')}
                  </p>
                  <button
                    onClick={signupWithPasskey}
                    disabled={signingUp()}
                    class="invitation-button"
                  >
                    {signingUp()
                      ? 'Creating account...'
                      : 'Sign Up with Passkey'}
                  </button>
                </Show>
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default OrganizationsInvitationPage;
