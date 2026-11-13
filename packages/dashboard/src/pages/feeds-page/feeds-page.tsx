import { Component, createEffect, createSignal, on, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
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
import { useTableCardLabels } from '../../hooks/useTableCardLabels';

/** The organization's data feeds. */
const FeedsPage: Component = () => {
  const { t, formatDate } = useI18n();
  const cardLabels = useTableCardLabels();
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
      const data: Feed[] = [];
      let page = 1;
      let count = 0;
      do {
        const result = await FeedsService.list(organizationId, {
          page,
          pageSize: 100,
        });
        if (current !== requestId) return;
        data.push(...result.data);
        count = result.count;
        page += 1;
      } while (data.length < count);
      if (current === requestId) setFeeds(data);
    } catch {
      if (current === requestId) toast.error(t('feeds.errors.load'));
    } finally {
      if (current === requestId) setLoading(false);
    }
  };

  createEffect(on(orgId, (organizationId) => void load(organizationId)));

  const feedPath = (feed: Feed) => `/org/${orgId()}/feeds/${feed.id}`;
  const openFeed = (feed: Feed) => navigate(feedPath(feed));

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
          <A
            class={styles.feedName}
            href={feedPath(feed)}
            onClick={(event) => event.stopPropagation()}
          >
            {feed.name}
          </A>
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
            cardLayout
            cardLabels={cardLabels}
            columns={columns}
            data={feeds()}
            hideCheckboxes
            onRowClick={openFeed}
          />
        </div>
      </Show>

      <Show when={showCreate()}>
        <Modal
          closeLabel={t('common.close')}
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
