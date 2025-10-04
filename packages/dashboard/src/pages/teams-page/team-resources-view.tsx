/**
 * Team Resources View
 *
 * (c) Castmill 2025
 */

import { TabItem, Tabs } from '@castmill/ui-common';
import { User } from '../../interfaces/user.interface';
import { TeamMembersView } from './team-members-view';
import { TeamInvitationsView } from './teams-invitations-view';

export const TeamResourcesView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (member: User) => void;
}) => {
  const resourcesTabs: TabItem[] = [
    {
      title: 'Members',
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
      title: 'Invitations',
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
