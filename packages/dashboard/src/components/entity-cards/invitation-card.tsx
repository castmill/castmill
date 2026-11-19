import {
  EntityCardField,
  EntityCardIcon,
  EntityCardStatus,
  TableCardContent,
  Timestamp,
} from '@castmill/ui-common';
import { BsEnvelope } from 'solid-icons/bs';

export interface InvitationCardItem {
  email: string;
  status?: string;
  role?: string;
  expires_at?: string;
}

/**
 * Compact mobile card content for pending invitations (organization and team
 * lists): role · status · expiry.
 */
export const invitationCard =
  (t: (key: string) => string, locale?: () => string) =>
  (item: InvitationCardItem): TableCardContent => ({
    visual: <EntityCardIcon icon={BsEnvelope} />,
    title: item.email,
    titleText: item.email,
    meta: [
      item.role,
      item.status && (
        <EntityCardStatus
          tone={item.status === 'accepted' ? 'success' : 'warning'}
        >
          {item.status}
        </EntityCardStatus>
      ),
      item.expires_at && (
        <EntityCardField label={t('common.expiresAt')}>
          <Timestamp
            value={item.expires_at}
            mode="relative"
            locale={locale?.()}
          />
        </EntityCardField>
      ),
    ],
  });
