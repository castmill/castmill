import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import { checkAuth, getUser } from '../../components/auth'; // your existing auth helpers
import { OrganizationsService } from '../../services/organizations.service';
import { useI18n } from '../../i18n';

interface Invitation {
  email: string;
  organization_id: string;
  status: string; // "invited", "expired", etc.
  expires_at?: string;
  // Add any other fields your backend returns
  organization_name: string;
}

const OrganizationsInvitationPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [invitation, setInvitation] = createSignal<Invitation | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [loading, setLoading] = createSignal<boolean>(true);

  // 1. Read the token from the query param
  const token = searchParams.token || '';

  // 2. Fetch invitation details from the server (if token is present)
  async function loadInvitation() {
    if (!token) {
      setErrorMessage('No invitation token provided.');
      setLoading(false);
      return;
    }

    try {
      const email = getUser()?.email;
      if (!email) {
        throw new Error('Not logged in.');
      }
      const result = await OrganizationsService.getInvitation(email, token);

      setInvitation(result);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error loading invitation.');
    } finally {
      setLoading(false);
    }
  }

  // 3. Accept the invitation
  async function acceptInvitation() {
    // Additional checks (e.g. is invitation expired?) can be done here or by your backend
    try {
      const email = invitation()?.email!;
      const result = await OrganizationsService.acceptInvitation(email, token);

      console.log(result);

      navigate(`/organization`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error accepting invitation.');
    }
  }

  // 4. On mount, load invitation details + check auth
  onMount(async () => {
    await loadInvitation();

    if (!checkAuth()) {
      // Not logged in, so let's redirect them to /login
      // but preserve the entire /invite?token=XYZ as redirect target
      const currentUrl = `/invite?token=${encodeURIComponent(token)}`;
      navigate(`/login?redirectTo=${encodeURIComponent(currentUrl)}`, {
        replace: true,
      });
      return;
    }

    // If user is logged in, we can either automatically accept
    // or wait for them to click a button. Usually you might
    // check email mismatch, etc. right here:
    const user = getUser();
    const inviteEmail = invitation()?.email;

    if (inviteEmail && user?.email && inviteEmail !== user.email) {
      setErrorMessage(
        `Mismatch: Invitation was sent to ${inviteEmail}, you are signed in as ${user.email}.`
      );
      // Possibly give them an option to sign out, or forcibly do so, etc.
    }
  });

  return (
    <div>
      <h1>
        You have been invited to join the organization{' '}
        {`${invitation()?.organization_name}`}
      </h1>
      <Show when={loading()}>
        <p>{t('common.loadingInvitation')}</p>
      </Show>
      <Show when={!loading() && errorMessage()}>
        <p style={{ color: 'red' }}>{errorMessage()}</p>
      </Show>
      <Show when={!loading() && invitation()}>
        <p>
          {t('common.invitedEmail')} <b>{invitation()?.email}</b>
        </p>
        <p>
          {t('common.status')}: <b>{invitation()?.status}</b>
        </p>
        <button onClick={acceptInvitation}>
          {t('common.acceptInvitation')}
        </button>
      </Show>
    </div>
  );
};

export default OrganizationsInvitationPage;
