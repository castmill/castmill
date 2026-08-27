/**
 * Team Resources View
 *
 * (c) Castmill 2025
 */

import { createMemo, createSignal } from 'solid-js';
import { User } from '../../interfaces/user.interface';
import { TeamMembersView } from './team-members-view';
import { TeamInvitationsView } from './teams-invitations-view';
import { useI18n } from '../../i18n';
import { TabItem, Tabs } from '@castmill/ui-common';
import styles from './teams-page.module.scss';

export const TeamResourcesView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (member: User) => void;
}) => {
  const { t } = useI18n();
  const [invitationRefreshKey, setInvitationRefreshKey] = createSignal(0);

  const triggerInvitationRefresh = () =>
    setInvitationRefreshKey((current) => current + 1);

  const tabs = createMemo<TabItem[]>(() => [
    {
      title: t('teams.members'),
      content: () => (
        <section class={styles.resourcesSection}>
          <TeamMembersView
            organizationId={props.organizationId}
            teamId={props.teamId}
            onRemove={props.onRemove}
            onInvitationSent={triggerInvitationRefresh}
          />
        </section>
      ),
    },
    {
      title: t('teams.invitations'),
      content: () => (
        <section class={styles.resourcesSection}>
          <TeamInvitationsView
            organizationId={props.organizationId}
            teamId={props.teamId}
            onRemove={(invitation) => {
              console.log('Remove invitation', invitation);
            }}
            refreshKey={invitationRefreshKey()}
          />
        </section>
      ),
    },
  ]);

  return (
    <div class={styles.resourcesContainer}>
      <Tabs tabs={tabs()} initialIndex={0} />
    </div>
  );
};
