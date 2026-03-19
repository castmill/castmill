/**
 * Setup Passkey Component.
 *
 * This component handles the passkey creation flow for custom domains.
 * When a network admin adds a custom domain (e.g. signage.acmecorp.com),
 * they receive a magic link via email. Clicking that link brings them
 * to this page on the custom domain, where they create a new passkey
 * bound to that domain. After that, they can log in normally.
 *
 * The flow reuses the existing credential recovery infrastructure:
 * same token generation, same verification, same passkey creation API.
 * The only difference is the URL points to the custom domain and this
 * component provides domain-appropriate messaging.
 */
import { Component, createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { arrayBufferToBase64, base64URLToArrayBuffer } from '../utils';
import { baseUrl, domain } from '../../env';
import { loginUser } from '../auth';
import { useI18n } from '../../i18n';
import './login.scss';

const encoder = new TextEncoder();

const SetupPasskey: Component = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal<boolean>(false);
  const [status, setStatus] = createSignal<string>('');
  const [error, setError] = createSignal<string>('');
  const [userEmail, setUserEmail] = createSignal<string>('');
  const [tokenValid, setTokenValid] = createSignal<boolean>(false);
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);
  const [success, setSuccess] = createSignal<boolean>(false);

  const token = searchParams.token;

  onMount(async () => {
    // Check passkey support
    if (
      !window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable
    ) {
      setError(t('setupPasskey.passkeysNotSupported'));
      return;
    }

    const [conditional, userVerifying] = await Promise.all([
      PublicKeyCredential.isConditionalMediationAvailable(),
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    ]);

    if (!conditional || !userVerifying) {
      setError(t('setupPasskey.passkeysNotSupported'));
      return;
    }

    setSupportsPasskeys(true);

    if (!token) {
      setError(t('setupPasskey.invalidLink'));
      return;
    }

    // Verify the token using the existing recovery verify endpoint
    try {
      setStatus(t('setupPasskey.verifying'));
      const response = await fetch(
        `${baseUrl}/credentials/recover/verify?token=${encodeURIComponent(token)}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.user.email);
        setTokenValid(true);
        setStatus('');
      } else {
        setError(t('setupPasskey.expiredLink'));
      }
    } catch (err) {
      console.error('Token verification failed:', err);
      setError(t('setupPasskey.verificationFailed'));
    }
  });

  const createPasskey = async () => {
    if (!token) return;

    setLoading(true);
    setStatus(t('setupPasskey.creatingPasskey'));
    setError('');

    try {
      // Get challenge from the recovery endpoint
      const challengeResponse = await fetch(
        `${baseUrl}/credentials/recover/challenge?token=${encodeURIComponent(token)}`,
        { credentials: 'include' }
      );

      if (!challengeResponse.ok) {
        setError(t('setupPasskey.challengeFailed'));
        setLoading(false);
        setStatus('');
        return;
      }

      const {
        challenge,
        user_id,
        email: userEmail,
      } = await challengeResponse.json();

      // Create passkey bound to THIS domain (the custom domain)
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          rp: {
            id: domain,
            name: 'Castmill',
          },
          user: {
            id: encoder.encode(user_id),
            name: userEmail,
            displayName: userEmail,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -8 }, // Ed25519
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
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
        setError(t('setupPasskey.creationCancelled'));
        setLoading(false);
        setStatus('');
        return;
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const authAttestationResponse =
        publicKeyCredential.response as AuthenticatorAttestationResponse;
      const publicKey = authAttestationResponse.getPublicKey();

      if (!publicKey) {
        setError(t('setupPasskey.noPublicKey'));
        setLoading(false);
        setStatus('');
        return;
      }

      const clientDataJSON = new TextDecoder().decode(
        authAttestationResponse.clientDataJSON
      );

      // Register the credential using the recovery endpoint
      const result = await fetch(`${baseUrl}/credentials/recover/credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          credential_id: publicKeyCredential.id,
          public_key_spki: arrayBufferToBase64(publicKey),
          raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
          client_data_json: clientDataJSON,
        }),
        credentials: 'include',
      });

      if (!result.ok) {
        setError(t('setupPasskey.registrationFailed'));
        setLoading(false);
        setStatus('');
        return;
      }

      // Log the user in and redirect to dashboard
      await loginUser();
      setSuccess(true);
      setStatus(t('setupPasskey.success'));
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('Passkey creation failed:', err);
      setSuccess(false);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError(t('setupPasskey.creationCancelled'));
      } else {
        setError(t('setupPasskey.unexpectedError'));
      }
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div class="castmill-login">
      <Show when={loading()}>
        <div class="loading-overlay">{t('common.loading')}</div>
      </Show>

      <div class="login-container">
        <div class="login-box">
          <h2>{t('setupPasskey.title')}</h2>
          <p class="info-message" style={{ 'margin-bottom': '1.5em' }}>
            {t('setupPasskey.subtitle', { domain })}
          </p>

          <Show when={error()}>
            <div class="error">{error()}</div>
            <button
              class="login-button"
              onClick={() => navigate('/login')}
              style={{ 'margin-top': '20px' }}
            >
              {t('common.backToLogin')}
            </button>
          </Show>

          <Show when={success()}>
            <div
              class="success"
              style={{ color: '#10b981', 'margin-top': '1em' }}
            >
              {status()}
            </div>
          </Show>

          <Show
            when={!error() && !success() && tokenValid() && supportsPasskeys()}
          >
            <p class="info-message">
              {t('setupPasskey.instructions', { email: userEmail() })}
            </p>

            <button
              class="signup-button"
              onClick={createPasskey}
              disabled={loading()}
            >
              {t('setupPasskey.createButton')}
            </button>

            <Show when={status()}>
              <p class="status">{status()}</p>
            </Show>
          </Show>

          <Show when={!error() && !success() && !tokenValid() && status()}>
            <p class="status">{status()}</p>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SetupPasskey;
