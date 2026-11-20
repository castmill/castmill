import {
  EntityCardField,
  EntityCardMetaItem,
  EntityCardNotice,
  EntityCardStatus,
} from '@castmill/ui-common';
import { JSX } from 'solid-js';

export interface NetworkCardEntity {
  inserted_at: string;
  blocked_at?: string | null;
  blocked_reason?: string | null;
}

/**
 * Shared card parts for network-managed users and organizations: a "Blocked"
 * status and created date in the metadata, and the block reason (when given)
 * as a visible footer notice.
 */
export const networkEntityCardParts = (
  t: (key: string) => string,
  entity: NetworkCardEntity
): { meta: EntityCardMetaItem[]; footer?: JSX.Element } => {
  const blocked = !!entity.blocked_at;
  return {
    meta: [
      blocked && !entity.blocked_reason && (
        <EntityCardStatus tone="danger">
          {t('network.status.blocked')}
        </EntityCardStatus>
      ),
      <EntityCardField label={t('common.created')}>
        {new Date(entity.inserted_at).toLocaleDateString()}
      </EntityCardField>,
    ],
    footer:
      blocked && entity.blocked_reason ? (
        <EntityCardNotice tone="danger" detail={entity.blocked_reason}>
          {t('network.status.blocked')}
        </EntityCardNotice>
      ) : undefined,
  };
};
