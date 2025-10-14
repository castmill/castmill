import {
  Component,
  createSignal,
  Match,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import { arrayBufferToBase64, base64URLToArrayBuffer } from '../utils';

import './login.scss';
import { loginUser, resetSession } from '../auth';
import { useNavigate } from '@solidjs/router';
import SignUpEmailSent from '../signup/signup-email-sent';
import RecoverCredentials from './recover-credentials';

import { baseUrl, domain } from '../../env';
import { useI18n } from '../../i18n';

const encoder = new TextEncoder(); // Creates a new encoder

const Login: Component = () => {
  const { t } = useI18n();
  const [isMounted, setIsMounted] = createSignal<boolean>(false);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [status, setStatus] = createSignal<string>('Ready');
  const [error, setError] = createSignal<string>('');
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);

  // Check for email parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const emailParam = urlParams.get('email') || '';

  const [email, setEmail] = createSignal<string>(emailParam);
  const [disabledSignUp, setDisabledSignUp] = createSignal<boolean>(
    emailParam ? false : true
  );
  const [showEmailSent, setShowEmailSent] = createSignal<boolean>(false);
  const [showRecoverCredentials, setShowRecoverCredentials] =
    createSignal<boolean>(false);

  const navigate = useNavigate();

  resetSession();

  async function checkPasskeysSupport() {
    if (
      !window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable
    ) {
      return false;
    }
    const [conditional, userVerifiying] = await Promise.all([
      PublicKeyCredential.isConditionalMediationAvailable(),
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    ]);
    return conditional && userVerifiying;
  }

  onMount(async () => {
    if (!(await checkPasskeysSupport())) {
      setStatus('Passkey not supported');
      return;
    } else {
      setSupportsPasskeys(true);
    }
    setIsMounted(true);
  });

  const loginWithPasskey = async (): Promise<void> => {
    try {
      setStatus('Authenticating...');

      const response = await fetch(`${baseUrl}/sessions/challenges`, {
        credentials: 'include', // Essential for including cookies
      });
      if (!response.ok) {
        console.error('Failed to get challenge');
        setStatus('Authentication failed');
        return;
      }

      const { challenge } = (await response.json()) as { challenge: string };
      console.log('Challenge:', challenge);

      const publicKey: PublicKeyCredentialRequestOptions = {
        rpId: domain,
        challenge: base64URLToArrayBuffer(challenge),
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKey,
      });

      if (!credential) {
        console.error('No credentials received');
        setStatus('Authentication failed');
        return;
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const authAssertionResponse =
        publicKeyCredential.response as AuthenticatorAssertionResponse;

      const clientDataJSON = new TextDecoder().decode(
        authAssertionResponse.clientDataJSON
      );

      const result = await fetch(`${baseUrl}/sessions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_id: publicKeyCredential.id,
          raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
          client_data_json: clientDataJSON,
          authenticator_data: arrayBufferToBase64(
            authAssertionResponse.authenticatorData
          ),
          signature: arrayBufferToBase64(authAssertionResponse.signature),
          email,
          challenge,
        }),
        credentials: 'include',
      });

      if (!result.ok) {
        console.error('Failed to authenticate');
        setStatus('Authentication failed');
        return;
      } else {
        setStatus('Authenticated');

        await loginUser();

        // Redirect to page specified by the redirectTo query parameter of '/' if not present
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirectTo') || '/';
        navigate(redirectTo);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setStatus('Authentication failed');
    }
  };

  const startSignupProcess = async (): Promise<void> => {
    // Send the email to the server to start the signup process
    // The server will send a challenge to the email with a link to the SignUp component
    setLoading(true);

    const result = await fetch(`${baseUrl}/signups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email: email() }),
    });

    if (!result.ok) {
      setStatus('Failed to start signup process');
      setError(`Failed to start signup process ${result.statusText}`);
    } else {
      setStatus('Check your email for the signup link');
      setShowEmailSent(true);
    }
    setLoading(false);
  };

  const handleEmailChange = (event: Event) => {
    const target = event.target as HTMLInputElement; // Type assertion for target
    setEmail(target.value); // Update the email state with the input value

    if (isValidEmail()) {
      setDisabledSignUp(false);
    } else {
      setDisabledSignUp(true);
    }
  };

  // Check email has a valid format, using a regular expression
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = () => emailRegex.test(email());

  return (
    <Show when={isMounted()}>
      <div class="castmill-login">
        <Show when={loading()}>
          <div class="loading-overlay">{t('common.loading')}</div>
        </Show>

        <div class="login-container">
          <Show
            when={!showRecoverCredentials()}
            fallback={
              <RecoverCredentials
                onBack={() => setShowRecoverCredentials(false)}
              />
            }
          >
            <div class="login-box">
              <Switch fallback={<SignUpEmailSent />}>
                <Match when={error()}>
                  <div class="error">{error()}</div>
                </Match>
                <Match when={!showEmailSent()}>
                  <h2>Login</h2>

                  <button
                    class="signup-button"
                    onClick={loginWithPasskey}
                    disabled={!supportsPasskeys()}
                  >
                    {t('login.loginWithPasskey')}
                  </button>

                  <div>
                    <p>or</p>
                  </div>

                  <h2>{t('common.signup')}</h2>
                  <input
                    type="text"
                    placeholder="Email"
                    value={email()}
                    onChange={handleEmailChange}
                  />
                  <button
                    class="login-button"
                    onClick={startSignupProcess}
                    disabled={disabledSignUp()}
                  >
                    Continue
                  </button>

                  <p class="status">Status: {status()}</p>
                  <Show when={!supportsPasskeys()}>
                    <p class="warn">
                      Your browser does not support Passkeys. Link here with
                      more info...
                    </p>
                  </Show>

                  <div class="privacy">
                    <p>
                      We care about your privacy. Read our{' '}
                      <a href="#">Privacy Policy</a>.
                    </p>
                  </div>
                  <div>
                    <p>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowRecoverCredentials(true);
                        }}
                      >
                        {t('login.lostCredentials')}
                      </a>
                    </p>
                  </div>
                </Match>
              </Switch>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default Login;
