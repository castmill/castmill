/**
 * Team Resources View
 *
 * (c) Castmill 2025
 */

import { TabItem, Tabs } from '@castmill/ui-common';
import { User } from '../../interfaces/user.interface';
import { TeamMembersView } from './team-members-view';
import { TeamInvitationsView } from './teams-invitations-view';
import { useI18n } from '../../i18n';

export const TeamResourcesView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (member: User) => void;
}) => {
  const { t } = useI18n();

  const resourcesTabs: TabItem[] = [
    {
      title: t('teams.members'),
      content: () => (
        <TeamMembersView
          organizationId={props.organizationId}
          teamId={props.teamId}
          onRemove={(member) => {
            console.log('Remove member', member);
          }}
        />
      ),
    },
    {
      title: t('teams.invitations'),
      content: () => (
        <TeamInvitationsView
          organizationId={props.organizationId}
          teamId={props.teamId}
          onRemove={(member) => {
            console.log('Remove member', member);
          }}
        />
      ),
    },
  ];

  return <Tabs tabs={resourcesTabs} initialIndex={0} />;
};
