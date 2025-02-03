/**
 * Team Resources View
 *
 * (c) Castmill 2025
 */

import { TabItem, Tabs } from '@castmill/ui-common';
import { User } from '../../interfaces/user.interface';
import { ResourcesView } from './resources-view';
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
    {
      title: 'Medias',
      content: () => (
        <ResourcesView
          organizationId={props.organizationId}
          teamId={props.teamId}
          resourceType="medias"
          resourceName="Media"
        />
      ),
    },
    { title: 'Playlists', content: () => <div>Playlists</div> },
    { title: 'Devices', content: () => <div>Devices</div> },
    { title: 'Channels', content: () => <div>Channels</div> },
    { title: 'Teams', content: () => <div>Teams</div> },
  ];

  return <Tabs tabs={resourcesTabs} initialIndex={0} />;
};
