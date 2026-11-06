import { Component, createEffect, createSignal, on, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { BsPlus } from 'solid-icons/bs';
import { TbRss } from 'solid-icons/tb';
import { Button, Column, Modal, Table, useToast } from '@castmill/ui-common';

import { store } from '../../store/store';
import { useI18n } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { parseServerDate } from '../../services/agents.service';
import { Feed, FeedAttrs, FeedsService } from '../../services/feeds.service';
import { FeedForm, emptyFeedForm } from './feed-form';

import styles from './feeds-page.module.scss';

/** The organization's data feeds. */
const FeedsPage: Component = () => {
  const { t, formatDate } = useI18n();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const navigate = useNavigate();

  const orgId = () => store.organizations.selectedId;
  const canCreate = () => canPerformAction('feeds', 'create');

  const [feeds, setFeeds] = createSignal<Feed[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showCreate, setShowCreate] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  let requestId = 0;

  const load = async (organizationId = orgId()) => {
    const current = ++requestId;
    if (!organizationId) return;
    setLoading(true);
    try {
      const result = await FeedsService.list(organizationId, { pageSize: 100 });
      if (current === requestId) setFeeds(result.data);
    } catch {
      if (current === requestId) toast.error(t('feeds.errors.load'));
    } finally {
      if (current === requestId) setLoading(false);
    }
  };

  createEffect(on(orgId, (organizationId) => void load(organizationId)));

  const openFeed = (feed: Feed) => navigate(`/org/${orgId()}/feeds/${feed.id}`);

  const create = async (attrs: FeedAttrs) => {
    setSaving(true);
    try {
      const feed = await FeedsService.create(orgId()!, attrs);
      toast.success(t('feeds.created'));
      setShowCreate(false);
      openFeed(feed);
    } catch (error: any) {
      toast.error(
        error?.code === 'quota_exceeded'
          ? t('feeds.errors.quota')
          : t('feeds.errors.save', { message: error?.message || '' })
      );
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<string, Feed>[] = [
    {
      key: 'name',
      title: () => t('common.name'),
      render: (feed) => (
        <div class={styles.nameCell}>
          <span class={styles.feedName}>{feed.name}</span>
          <Show when={feed.description}>
            <span class={styles.muted}>{feed.description}</span>
          </Show>
        </div>
      ),
    },
    {
      key: 'mode',
      title: () => t('feeds.mode'),
      render: (feed) => <span>{t(`feeds.modes.${feed.mode}`)}</span>,
    },
    {
      key: 'entry_count',
      title: () => t('feeds.entries'),
      render: (feed) => <span>{feed.entry_count ?? '—'}</span>,
    },
    {
      key: 'data_updated_at',
      title: () => t('feeds.lastUpdate'),
      render: (feed) => (
        <span>
          {feed.data_updated_at
            ? formatDate(parseServerDate(feed.data_updated_at), 'Pp')
            : t('feeds.never')}
        </span>
      ),
    },
    {
      key: 'usage_count',
      title: () => t('feeds.usedBy'),
      render: (feed) => <span>{feed.usage_count ?? 0}</span>,
    },
  ];

  return (
    <div class={styles.feedsPage}>
      <div class={styles.header}>
        <div class={styles.headerText}>
          <h1>{t('feeds.title')}</h1>
          <p class={styles.description}>{t('feeds.description')}</p>
        </div>
        <Show when={canCreate()}>
          <div class={styles.headerAction}>
            <Button
              label={t('feeds.newFeed')}
              icon={BsPlus}
              color="primary"
              onClick={() => setShowCreate(true)}
            />
          </div>
        </Show>
      </div>

      <Show
        when={feeds().length > 0}
        fallback={
          <div class={styles.emptyState}>
            <Show when={!loading()} fallback={<p>{t('common.loading')}</p>}>
              <TbRss class={styles.emptyIcon} />
              <p>{t('feeds.empty')}</p>
              <Show when={canCreate()}>
                <Button
                  label={t('feeds.newFeed')}
                  icon={BsPlus}
                  color="primary"
                  onClick={() => setShowCreate(true)}
                />
              </Show>
            </Show>
          </div>
        }
      >
        <div data-testid="feeds-table" class={styles.table}>
          <Table<string, Feed>
            columns={columns}
            data={feeds()}
            hideCheckboxes
            onRowClick={openFeed}
          />
        </div>
      </Show>

      <Show when={showCreate()}>
        <Modal
          title={t('feeds.newFeed')}
          description={t('feeds.description')}
          onClose={() => setShowCreate(false)}
        >
          <FeedForm
            initial={emptyFeedForm()}
            submitLabel={t('common.create')}
            saving={saving()}
            onSubmit={create}
            onCancel={() => setShowCreate(false)}
          />
        </Modal>
      </Show>
    </div>
  );
};

export default FeedsPage;
