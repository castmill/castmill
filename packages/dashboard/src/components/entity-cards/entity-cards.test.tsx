import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@solidjs/testing-library';
import { EntityListCard } from '@castmill/ui-common';
import { invitationCard } from './invitation-card';
import { memberCard, memberDisplayName } from './member-card';
import { networkEntityCardParts } from './network-entity-card';

const t = (key: string) => (key === 'common.youIndicator' ? '(you)' : key);

const renderCard = (content: ReturnType<ReturnType<typeof memberCard>>) =>
  render(() => (
    <EntityListCard
      title={content.title ?? ''}
      subtitle={content.subtitle}
      visual={content.visual}
      meta={content.meta}
    />
  ));

describe('entity card adapters', () => {
  afterEach(cleanup);

  it('marks the current user and shows email and role', () => {
    const card = memberCard({ t, currentUserId: 'u1' })({
      user_id: 'u1',
      role: 'admin',
      user: { name: 'Ada', email: 'ada@example.com' },
    });
    expect(card.titleText).toBe('Ada (you)');
    const { getByText } = renderCard(card);
    expect(getByText('ada@example.com')).toBeTruthy();
    expect(getByText('admin')).toBeTruthy();
  });

  it('uses a custom role control and omits a missing join date', () => {
    const card = memberCard({
      t,
      role: (item) => <select aria-label="role">{item.role}</select>,
    })({ user_id: 'u2', role: 'member', user: { name: 'Bob' } });
    expect(card.titleText).toBe('Bob');
    expect(card.meta).toHaveLength(2);
    expect(card.meta?.[1]).toBeFalsy();
    const { getByLabelText } = renderCard(card);
    expect(getByLabelText('role')).toBeTruthy();
  });

  it('shows invitation role, status and expiry', () => {
    const card = invitationCard(t)({
      email: 'new@example.com',
      role: 'member',
      status: 'invited',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });
    const { getByText } = renderCard(card);
    expect(card.titleText).toBe('new@example.com');
    expect(getByText('invited')).toBeTruthy();
    expect(getByText('common.expiresAt', { exact: false })).toBeTruthy();
  });

  it('skips empty invitation fields', () => {
    const card = invitationCard(t)({ email: 'x@example.com' });
    expect(card.meta?.filter(Boolean)).toHaveLength(0);
  });

  it('marks only the signed-in member as "you"', () => {
    const item = { user_id: 'u1', user: { name: 'Ada' } };
    expect(memberDisplayName(t, item, 'u1')).toBe('Ada (you)');
    expect(memberDisplayName(t, item, 'u2')).toBe('Ada');
  });

  it('shows a blocked status, or the block reason as a notice', () => {
    const inserted_at = '2024-01-02T00:00:00Z';
    const plain = networkEntityCardParts(t, { inserted_at });
    expect(plain.meta.filter(Boolean)).toHaveLength(1);
    expect(plain.footer).toBeUndefined();

    const blocked = networkEntityCardParts(t, {
      inserted_at,
      blocked_at: inserted_at,
    });
    expect(blocked.meta.filter(Boolean)).toHaveLength(2);
    expect(blocked.footer).toBeUndefined();

    const withReason = networkEntityCardParts(t, {
      inserted_at,
      blocked_at: inserted_at,
      blocked_reason: 'Unpaid invoice',
    });
    expect(withReason.meta.filter(Boolean)).toHaveLength(1);
    render(() => (
      <EntityListCard
        title="Org"
        meta={withReason.meta}
        footer={withReason.footer}
      />
    ));
    expect(screen.getByText('network.status.blocked')).toBeInTheDocument();
    expect(screen.getByText('Unpaid invoice')).toBeInTheDocument();
  });
});
