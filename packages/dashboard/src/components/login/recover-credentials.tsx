import { Component, createSignal, Show } from 'solid-js';
import { baseUrl } from '../../env';
import { useI18n } from '../../i18n';
import './login.scss';

interface RecoverCredentialsProps {
  onBack: () => void;
}

const RecoverCredentials: Component<RecoverCredentialsProps> = (props) => {
  const { t } = useI18n();
  const [email, setEmail] = createSignal<string>('');
  const [loading, setLoading] = createSignal<boolean>(false);
  const [emailSent, setEmailSent] = createSignal<boolean>(false);
  const [error, setError] = createSignal<string>('');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = () => emailRegex.test(email());

  const handleEmailChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setEmail(target.value);
    setError('');
  };

  const handleEmailInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setEmail(target.value);
    setError('');
  };

  const handleSubmit = async () => {
    if (!isValidEmail()) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${baseUrl}/credentials/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email() }),
        credentials: 'include',
      });

      if (response.ok) {
        setEmailSent(true);
      } else {
        setError('Failed to send recovery email. Please try again.');
      }
    } catch (err) {
      console.error('Recovery request failed:', err);
      setError('Failed to send recovery email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-box">
      <Show
        when={!emailSent()}
        fallback={
          <>
            <h2>{t('credentialRecovery.checkYourEmail')}</h2>
            <p class="info-message">
              If your email is in our system, you will receive instructions to
              recover your credentials shortly.
            </p>
            <p class="info-message">
              Please check your email and follow the link to add a new passkey
              to your account.
            </p>
            <button class="login-button" onClick={props.onBack}>
              {t('common.backToLogin')}
            </button>
          </>
        }
      >
        <h2>{t('credentialRecovery.title')}</h2>
        <p class="info-message">
          Enter your email address and we'll send you instructions to add a new
          passkey to your account.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email()}
          onInput={handleEmailInput}
          onChange={handleEmailChange}
          disabled={loading()}
        />

        <Show when={error()}>
          <div class="error">{error()}</div>
        </Show>

        <button
          class="login-button"
          onClick={handleSubmit}
          disabled={!isValidEmail() || loading()}
        >
          {loading() ? 'Sending...' : 'Send Recovery Email'}
        </button>

        <button class="signup-button" onClick={props.onBack}>
          {t('common.backToLogin')}
        </button>
      </Show>
    </div>
  );
};

export default RecoverCredentials;
