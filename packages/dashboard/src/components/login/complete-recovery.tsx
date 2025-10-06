import { Component, createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { arrayBufferToBase64, base64URLToArrayBuffer } from '../utils';
import { baseUrl, domain } from '../../env';
import { loginUser } from '../auth';
import './login.scss';

const encoder = new TextEncoder();

const CompleteRecovery: Component = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal<boolean>(false);
  const [status, setStatus] = createSignal<string>('Verifying token...');
  const [error, setError] = createSignal<string>('');
  const [userEmail, setUserEmail] = createSignal<string>('');
  const [tokenValid, setTokenValid] = createSignal<boolean>(false);
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);

  const token = searchParams.token;
  const email = searchParams.email;

  onMount(async () => {
    // Check passkey support
    if (
      !window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable
    ) {
      setError('Your browser does not support Passkeys');
      setStatus('');
      return;
    }

    const [conditional, userVerifying] = await Promise.all([
      PublicKeyCredential.isConditionalMediationAvailable(),
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    ]);

    if (!conditional || !userVerifying) {
      setError('Your browser does not support Passkeys');
      setStatus('');
      return;
    }

    setSupportsPasskeys(true);

    // Verify the token
    if (!token) {
      setError('Invalid recovery link');
      setStatus('');
      return;
    }

    try {
      const response = await fetch(
        `${baseUrl}/credentials/recover/verify?token=${encodeURIComponent(token)}`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.user.email);
        setTokenValid(true);
        setStatus('Ready to add new passkey');
      } else {
        setError('Invalid or expired recovery link');
        setStatus('');
      }
    } catch (err) {
      console.error('Token verification failed:', err);
      setError('Failed to verify recovery link');
      setStatus('');
    }
  });

  const addNewPasskey = async () => {
    if (!token) {
      setError('Invalid recovery link');
      return;
    }

    setLoading(true);
    setStatus('Creating new passkey...');
    setError('');

    try {
      // Get challenge
      const challengeResponse = await fetch(
        `${baseUrl}/credentials/recover/challenge?token=${encodeURIComponent(token)}`,
        {
          credentials: 'include',
        }
      );

      if (!challengeResponse.ok) {
        setError('Failed to create passkey challenge');
        setLoading(false);
        setStatus('');
        return;
      }

      const {
        challenge,
        user_id,
        email: userEmail,
      } = await challengeResponse.json();

      // Create passkey
      const createOptions: CredentialCreationOptions = {
        publicKey: {
          rp: {
            id: domain,
            name: 'Castmill AB',
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
        setError('Failed to create passkey');
        setLoading(false);
        setStatus('');
        return;
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const authAttestationResponse =
        publicKeyCredential.response as AuthenticatorAttestationResponse;
      const publicKey = authAttestationResponse.getPublicKey();

      if (!publicKey) {
        setError('Failed to get public key from passkey');
        setLoading(false);
        setStatus('');
        return;
      }

      // Decode client data JSON to string (not Base64)
      const clientDataJSON = new TextDecoder().decode(
        authAttestationResponse.clientDataJSON
      );

      // Send credential to server
      const result = await fetch(`${baseUrl}/credentials/recover/credential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          credential_id: publicKeyCredential.id,
          public_key_spki: arrayBufferToBase64(publicKey),
          raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
          client_data_json: clientDataJSON,
        }),
        credentials: 'include',
      });

      if (!result.ok) {
        setError('Failed to add passkey to your account');
        setLoading(false);
        setStatus('');
        return;
      }

      setStatus('Passkey added successfully! Logging you in...');

      // Log in the user
      await loginUser();

      // Redirect to dashboard
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      console.error('Passkey creation failed:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey creation was cancelled or timed out');
      } else {
        setError('Failed to create passkey. Please try again.');
      }
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div class="castmill-login">
      <Show when={loading()}>
        <div class="loading-overlay">Loading...</div>
      </Show>

      <div class="login-container">
        <div class="login-box">
          <h2>Recover Your Credentials</h2>

          <Show when={error()}>
            <div class="error">{error()}</div>
            <button
              class="login-button"
              onClick={() => navigate('/login')}
              style={{ 'margin-top': '20px' }}
            >
              Back to Login
            </button>
          </Show>

          <Show when={!error() && tokenValid() && supportsPasskeys()}>
            <p class="info-message">
              Welcome back, {userEmail()}! Add a new passkey to regain access to
              your account.
            </p>

            <button
              class="signup-button"
              onClick={addNewPasskey}
              disabled={loading()}
            >
              Add New Passkey
            </button>

            <p class="status">Status: {status()}</p>
          </Show>

          <Show when={!error() && !tokenValid() && status()}>
            <p class="status">{status()}</p>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default CompleteRecovery;
