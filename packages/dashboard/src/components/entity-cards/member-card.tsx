import { JSX } from 'solid-js';
import {
  EntityCardIcon,
  TableCardContent,
  Timestamp,
} from '@castmill/ui-common';
import { IoPersonOutline } from 'solid-icons/io';

export interface MemberCardItem {
  user_id: string;
  role?: string;
  inserted_at?: string;
  user: { name: string; email?: string };
}

export interface MemberCardOptions {
  t: (key: string) => string;
  currentUserId?: string;
  locale?: () => string;
  /** Role control (e.g. an inline role dropdown); defaults to the role. */
  role?: (item: any) => JSX.Element;
  /** Label of the "joined" timestamp tooltip. */
  joinedLabel?: string;
}

/** Member name, marked "(you)" for the signed-in user. */
export const memberDisplayName = (
  t: (key: string) => string,
  item: Pick<MemberCardItem, 'user_id' | 'user'>,
  currentUserId?: string
) =>
  item.user_id === currentUserId
    ? `${item.user.name} ${t('common.youIndicator')}`
    : item.user.name;

/**
 * Compact mobile card content for organization and team members:
 * name (marked "you"), email, role · joined.
 */
export const memberCard =
  (options: MemberCardOptions) =>
  // Member tables are typed by their callers' row types; rows are membership
  // records with a nested user.
  (row: unknown): TableCardContent => {
    const item = row as MemberCardItem;
    const { t } = options;
    const name = memberDisplayName(t, item, options.currentUserId);
    return {
      visual: <EntityCardIcon icon={IoPersonOutline} />,
      title: name,
      titleText: name,
      subtitle: item.user.email,
      meta: [
        options.role ? options.role(item) : item.role,
        item.inserted_at && (
          <span title={options.joinedLabel ?? t('common.insertedAt')}>
            <Timestamp
              value={item.inserted_at}
              mode="relative"
              locale={options.locale?.()}
            />
          </span>
        ),
      ],
    };
  };
