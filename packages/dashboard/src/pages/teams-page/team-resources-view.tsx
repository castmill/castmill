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
    {
      title: t('teams.medias'),
      content: () => (
        <ResourcesView
          organizationId={props.organizationId}
          teamId={props.teamId}
          resourceType="medias"
          resourceName="Media"
        />
      ),
    },
    {
      title: t('teams.playlists'),
      content: () => <div>{t('teams.playlists')}</div>,
    },
    {
      title: t('teams.devices'),
      content: () => <div>{t('teams.devices')}</div>,
    },
    {
      title: t('teams.channels'),
      content: () => <div>{t('teams.channels')}</div>,
    },
    { title: t('teams.title'), content: () => <div>{t('teams.title')}</div> },
  ];

  return <Tabs tabs={resourcesTabs} initialIndex={0} />;
};
