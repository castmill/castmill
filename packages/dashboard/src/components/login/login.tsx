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
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  Locale,
} from '../../i18n/types';

const encoder = new TextEncoder(); // Creates a new encoder

interface NetworkSettings {
  name: string;
  invitation_only: boolean;
  logo: string;
  default_locale: string;
  privacy_policy_url: string | null;
}

const Login: Component = () => {
  const { t, setLocale } = useI18n();
  const [isMounted, setIsMounted] = createSignal<boolean>(false);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [error, setError] = createSignal<string>('');
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);
  const [networkSettings, setNetworkSettings] =
    createSignal<NetworkSettings | null>(null);

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

  async function fetchNetworkSettings() {
    try {
      const response = await fetch(
        `${baseUrl}/dashboard/network/public-settings`,
        {
          credentials: 'include',
        }
      );
      if (response.ok) {
        const settings = await response.json();
        setNetworkSettings(settings);

        // Apply network's default locale if user has no stored preference
        const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
        if (
          !storedLocale &&
          settings.default_locale &&
          SUPPORTED_LOCALES.some((l) => l.code === settings.default_locale)
        ) {
          setLocale(settings.default_locale as Locale);
        }
      }
    } catch (error) {
      console.error('Failed to fetch network settings:', error);
    }
  }

  onMount(async () => {
    await fetchNetworkSettings();

    if (!(await checkPasskeysSupport())) {
      setSupportsPasskeys(false);
      setError(t('login.passkeysNotSupported'));
    } else {
      setSupportsPasskeys(true);
    }
    setIsMounted(true);
  });

  const loginWithPasskey = async (): Promise<void> => {
    try {
      setError('');
      setLoading(true);

      const response = await fetch(`${baseUrl}/sessions/challenges`, {
        credentials: 'include', // Essential for including cookies
      });
      if (!response.ok) {
        console.error('Failed to get challenge');
        setError(t('login.errors.authenticationFailed'));
        setLoading(false);
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
        setError(t('login.errors.authenticationFailed'));
        setLoading(false);
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
        // Try to parse the error response to get specific error codes
        try {
          const errorData = await result.json();
          if (errorData.code === 'user_blocked') {
            setError(
              t('login.errors.userBlocked', { reason: errorData.message || '' })
            );
          } else if (errorData.code === 'organization_blocked') {
            setError(
              t('login.errors.organizationBlocked', {
                reason: errorData.message || '',
              })
            );
          } else {
            setError(t('login.errors.authenticationFailed'));
          }
        } catch {
          setError(t('login.errors.authenticationFailed'));
        }
        setLoading(false);
        return;
      } else {
        await loginUser();

        // Redirect to page specified by the redirectTo query parameter of '/' if not present
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirectTo') || '/';
        navigate(redirectTo);
      }
    } catch (error) {
      console.error('Authentication error:', error);

      // If user cancelled/aborted the passkey authentication, just reset loading state
      // without showing an error - let them try again
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setLoading(false);
        return;
      }

      setError(t('login.errors.authenticationFailed'));
      setLoading(false);
    }
  };

  const startSignupProcess = async (): Promise<void> => {
    // Send the email to the server to start the signup process
    // The server will send a challenge to the email with a link to the SignUp component
    setLoading(true);
    setError('');

    const result = await fetch(`${baseUrl}/signups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email: email() }),
    });

    if (!result.ok) {
      const data = await result.json().catch(() => ({}));
      setError(data.msg || t('login.errors.signupFailed'));
    } else {
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

                  <Show
                    when={!networkSettings()?.invitation_only}
                    fallback={
                      <div class="invitation-only-notice">
                        <p>{t('login.invitationOnlyNotice')}</p>
                      </div>
                    }
                  >
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
                  </Show>

                  <Show when={!supportsPasskeys()}>
                    <p class="warn">
                      Your browser does not support Passkeys. Link here with
                      more info...
                    </p>
                  </Show>

                  <Show when={networkSettings()?.privacy_policy_url}>
                    <div class="privacy">
                      <p>
                        {t('login.privacyNotice')}{' '}
                        <a
                          href={networkSettings()?.privacy_policy_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('login.privacyPolicy')}
                        </a>
                        .
                      </p>
                    </div>
                  </Show>
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
