import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, onMount, Show } from 'solid-js';
import { getUser } from '../../components/auth';
import { TeamsService } from '../../services/teams.service';
import { useI18n } from '../../i18n';
import { useToast } from '@castmill/ui-common';
import type { TeamRole } from '../../types/team-role.type';

import './teams-invitations-page.scss';

interface Invitation {
  email: string;
  team_id: string;
  status: string; // "invited", "expired", etc.
  expires_at?: string;
  team_name: string;
  organization_id?: string;
  organization_name?: string;
  expired: boolean;
  role: TeamRole;
}

const TeamsInvitationPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [invitation, setInvitation] = createSignal<Invitation | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [loading, setLoading] = createSignal<boolean>(true);
  const [accepting, setAccepting] = createSignal<boolean>(false);

  const token = searchParams.token || '';

  const redirectToLogin = () => {
    const currentUrl = `/invite?token=${encodeURIComponent(token)}`;
    navigate(`/login?redirectTo=${encodeURIComponent(currentUrl)}`, {
      replace: true,
    });
  };

  async function loadInvitation(email: string) {
    try {
      const result = await TeamsService.getInvitation(email, token);
      setInvitation(result);
    } catch (error: any) {
      setErrorMessage(error.message || 'Error loading invitation.');
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvitation() {
    setAccepting(true);
    try {
      const email = invitation()?.email!;
      await TeamsService.acceptInvitation(email, token);

      toast.success('Invitation accepted successfully!');
      const orgId = invitation()?.organization_id;
      if (orgId) {
        navigate(`/org/${orgId}/teams`);
      } else {
        navigate(`/`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error accepting invitation.');
    } finally {
      setAccepting(false);
    }
  }

  async function rejectInvitation() {
    try {
      await TeamsService.rejectInvitation(token);
      toast.success('Invitation rejected successfully');
      const orgId = invitation()?.organization_id;
      if (orgId) {
        navigate(`/org/${orgId}/teams`);
      } else {
        navigate(`/`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error rejecting invitation.');
    }
  }

  onMount(async () => {
    if (!token) {
      setErrorMessage('No invitation token provided.');
      setLoading(false);
      return;
    }

    const email = getUser()?.email;

    if (!email) {
      redirectToLogin();
      return;
    }

    await loadInvitation(email);

    const inviteEmail = invitation()?.email;

    if (inviteEmail && inviteEmail !== email) {
      setErrorMessage(
        `Mismatch: Invitation was sent to ${inviteEmail}, you are signed in as ${email}.`
      );
    }
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h2 class="text-2xl font-bold mb-2">
                {t('teams.invitation.title')}
              </h2>
              <p class="text-gray-600">
                You've been invited to join the team{' '}
                <span class="font-semibold text-indigo-600">
                  {invitation()?.team_name}
                </span>
                {invitation()?.organization_name && (
                  <span>
                    {' '}
                    in{' '}
                    <span class="font-semibold">
                      {invitation()?.organization_name}
                    </span>
                  </span>
                )}
              </p>
            </div>

            {/* Email display */}
            <div class="email-box">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                {t('teams.invitation.emailAddress')}
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

            {/* Role display */}
            <Show when={invitation()?.role}>
              <div class="email-box">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  {t('teams.invitation.teamRole')}
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span class="font-medium">
                    {invitation()?.role === 'admin'
                      ? t('organization.teamRoleAdmin')
                      : t('organization.teamRoleMember')}
                  </span>
                </div>
              </div>
            </Show>

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
                <p>{t('teams.invitation.expired')}</p>
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
              <div class="action-buttons">
                <button
                  class="btn-accept"
                  onClick={acceptInvitation}
                  disabled={accepting()}
                >
                  <Show
                    when={!accepting()}
                    fallback={<span>{t('teams.invitation.accepting')}</span>}
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
                    <span>{t('teams.invitation.accept')}</span>
                  </Show>
                </button>

                <button
                  class="btn-reject"
                  onClick={rejectInvitation}
                  disabled={accepting()}
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
                  <span>Reject</span>
                </button>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default TeamsInvitationPage;
