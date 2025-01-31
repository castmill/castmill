// src/pages/teams-invitation-page/TeamsInvitationPage.tsx

import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import { checkAuth, getUser } from '../../components/auth'; // your existing auth helpers
import { TeamsService } from '../../services/teams.service';

interface Invitation {
  email: string;
  team_id: string;
  status: string; // "invited", "expired", etc.
  expires_at?: string;
  // Add any other fields your backend returns
  team_name: string;
}

const TeamsInvitationPage = () => {
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
      const result = await TeamsService.getInvitation(email, token);

      console.log({ result });

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
      const result = await TeamsService.acceptInvitation(email, token);

      // If successful, navigate to the team page or dashboard
      // The backend can return the team_id if you want to route to a specific team:
      //const updatedInvite: Invitation = await res.json();
      navigate(`/teams`);
      // or navigate(`/teams/${updatedInvite.team_id}`);
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
      <h1>You have been invited to join the team {`${invitation()?.team_name}`}</h1>
      <Show when={loading()}>
        <p>Loading invitation...</p>
      </Show>
      <Show when={!loading() && errorMessage()}>
        <p style={{ color: 'red' }}>{errorMessage()}</p>
      </Show>
      <Show when={!loading() && invitation()}>
        <p>
          Invited Email: <b>{invitation()?.email}</b>
        </p>
        <p>
          Status: <b>{invitation()?.status}</b>
        </p>
        <button onClick={acceptInvitation}>Accept Invitation</button>
      </Show>
    </div>
  );
};

export default TeamsInvitationPage;
