import { Component } from 'solid-js';
import { useI18n } from '../../i18n';

const SignUpEmailSent: Component = () => {
  const { t } = useI18n();
  return (
    <div>
      <h2>{t('signup.checkYourEmail')}</h2>

      <p>
        We have sent a verification link to your email. Click the link to
        complete the sign up process. If you do not receive the email, it could
        be that you entered an existing email. Please try again with a different
        email.
      </p>
      <p>
        Feel free to close this tab and come back later to complete the sign up
        process.
      </p>
    </div>
  );
};

export default SignUpEmailSent;
