import { Component, For, Show, createEffect, createSignal, on } from 'solid-js';
import { A, useNavigate, useParams } from '@solidjs/router';
import { AiOutlineDelete } from 'solid-icons/ai';
import { BsArrowClockwise, BsArrowLeft } from 'solid-icons/bs';
import { Button, ConfirmDialog, Tabs, useToast } from '@castmill/ui-common';

import { store } from '../../store/store';
import { useI18n } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { parseServerDate } from '../../services/agents.service';
import {
  FeedAttrs,
  FeedData,
  FeedDetails,
  FeedEntry,
  FeedsService,
} from '../../services/feeds.service';
import { FeedConnect } from './feed-connect';
import { FeedMedia } from './feed-media';
import { FeedForm, FeedFormValues } from './feed-form';

import styles from './feeds-page.module.scss';

const RESERVED = ['id', 'received_at', 'external_id'];

/** An entry's own fields, without the ones Castmill adds. */
export const entryFields = (entry: FeedEntry) =>
  Object.fromEntries(
    Object.entries(entry).filter(([key]) => !RESERVED.includes(key))
  );

const formValues = (feed: FeedDetails): FeedFormValues => ({
  name: feed.name,
  description: feed.description || '',
  mode: feed.mode,
  keep: feed.keep,
  schema: feed.schema ? JSON.stringify(feed.schema, null, 2) : '',
  media_fields: feed.media_fields || [],
});

/** Parses a JSON object typed by the user, or returns null. */
export const parseJsonObject = (text: string) => {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/** One data feed: its entries, connection details and settings. */
const FeedPage: Component = () => {
  const { t, formatDate } = useI18n();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const params = useParams<{ feedId: string }>();
  const navigate = useNavigate();

  const orgId = () => store.organizations.selectedId!;
  const canUpdate = () => canPerformAction('feeds', 'update');
  const canDelete = () => canPerformAction('feeds', 'delete');

  const [feed, setFeed] = createSignal<FeedDetails | null>(null);
  const [data, setData] = createSignal<FeedData | null>(null);
  const [notFound, setNotFound] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [testValue, setTestValue] = createSignal('');
  const [sending, setSending] = createSignal(false);
  const [confirm, setConfirm] = createSignal<
    'delete' | 'clear' | { entry: FeedEntry } | null
  >(null);

  const formatTime = (value: string | null | undefined) =>
    value ? formatDate(parseServerDate(value), 'Pp') : t('feeds.never');

  const loadData = async () => {
    try {
      const result = await FeedsService.data(orgId(), params.feedId);
      setData(result.data);
    } catch {
      toast.error(t('feeds.errors.loadFeed'));
    }
  };

  const load = async () => {
    try {
      setFeed(await FeedsService.get(orgId(), params.feedId));
      setNotFound(false);
      await loadData();
    } catch (error: any) {
      if (error?.status === 404) setNotFound(true);
      else toast.error(t('feeds.errors.loadFeed'));
    }
  };

  createEffect(
    on([orgId, () => params.feedId], ([organizationId]) => {
      setFeed(null);
      setData(null);
      // On a direct link, the organization is selected after the page mounts.
      if (!organizationId) return;
      void load();
    })
  );

  const save = async (attrs: FeedAttrs) => {
    setSaving(true);
    try {
      setFeed(await FeedsService.update(orgId(), params.feedId, attrs));
      await loadData();
      toast.success(t('feeds.saved'));
    } catch (error: any) {
      toast.error(t('feeds.errors.save', { message: error?.message || '' }));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (event: Event) => {
    event.preventDefault();
    const value = parseJsonObject(testValue());
    if (!value) {
      toast.error(t('feeds.test.invalidJson'));
      return;
    }
    setSending(true);
    try {
      const result = await FeedsService.sendTest(
        orgId(),
        params.feedId,
        feed()!.mode,
        value
      );
      setData(result.data);
      setTestValue('');
      toast.success(t('feeds.test.sent'));
    } catch (error: any) {
      toast.error(t('feeds.errors.action', { message: error?.message || '' }));
    } finally {
      setSending(false);
    }
  };

  const runConfirmed = async () => {
    const action = confirm();
    setConfirm(null);
    try {
      if (action === 'delete') {
        await FeedsService.remove(orgId(), params.feedId);
        toast.success(t('feeds.deleted'));
        navigate(`/org/${orgId()}/feeds`);
        return;
      }
      if (action === 'clear') {
        await FeedsService.clear(orgId(), params.feedId);
      } else if (action) {
        await FeedsService.deleteEntry(orgId(), params.feedId, action.entry.id);
      }
      await loadData();
    } catch (error: any) {
      toast.error(t('feeds.errors.action', { message: error?.message || '' }));
    }
  };

  const confirmTexts = () => {
    const action = confirm();
    const name = feed()?.name || '';
    if (action === 'delete') {
      return {
        title: t('feeds.deleteTitle'),
        message: t('feeds.deleteMessage', { name }),
        label: t('common.delete'),
      };
    }
    if (action === 'clear') {
      return {
        title: t('feeds.clearTitle'),
        message: t('feeds.clearMessage', { name }),
        label: t('feeds.clear'),
      };
    }
    return {
      title: t('feeds.deleteEntry'),
      message: t('feeds.deleteEntryMessage'),
      label: t('common.delete'),
    };
  };

  const entriesTab = () => (
    <div class={styles.tabPanel}>
      <div class={styles.sectionHeader}>
        <span class={styles.muted}>
          {t('feeds.updatedAt', { time: formatTime(data()?.updated_at) })}
        </span>
        <div class={styles.actionsRow}>
          <Button
            label={t('feeds.refresh')}
            icon={BsArrowClockwise}
            color="secondary"
            onClick={() => void loadData()}
          />
          <Show when={canUpdate()}>
            <Button
              label={t('feeds.clear')}
              color="danger"
              onClick={() => setConfirm('clear')}
            />
          </Show>
        </div>
      </div>

      <Show
        when={feed()?.mode === 'list'}
        fallback={
          <Show
            when={data()?.document}
            fallback={<p class={styles.muted}>{t('feeds.noDocument')}</p>}
          >
            <pre class={styles.snippet} data-testid="feed-document">
              {JSON.stringify(data()?.document, null, 2)}
            </pre>
          </Show>
        }
      >
        <Show
          when={(data()?.entries || []).length > 0}
          fallback={<p class={styles.muted}>{t('feeds.noEntries')}</p>}
        >
          <ul class={styles.entries} data-testid="feed-entries">
            <For each={data()?.entries}>
              {(entry) => (
                <li class={styles.entry}>
                  <div class={styles.entryHeader}>
                    <span class={styles.muted}>
                      {t('feeds.receivedAt', {
                        time: formatTime(entry.received_at),
                      })}
                    </span>
                    <Show when={entry.external_id}>
                      <code class={styles.secretChip}>
                        {t('feeds.externalId')}: {entry.external_id}
                      </code>
                    </Show>
                    <Show when={canUpdate()}>
                      <button
                        type="button"
                        class={styles.iconButton}
                        title={t('feeds.deleteEntry')}
                        aria-label={t('feeds.deleteEntry')}
                        onClick={() => setConfirm({ entry })}
                      >
                        <AiOutlineDelete />
                      </button>
                    </Show>
                  </div>
                  <pre class={styles.entryData}>
                    {JSON.stringify(entryFields(entry), null, 2)}
                  </pre>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>

      <Show when={canUpdate()}>
        <form class={styles.testForm} onSubmit={sendTest}>
          <label class={styles.fieldLabel} for="feed-test-entry">
            {feed()?.mode === 'list'
              ? t('feeds.test.title')
              : t('feeds.test.titleDocument')}
          </label>
          <p class={styles.muted}>{t('feeds.test.help')}</p>
          <textarea
            id="feed-test-entry"
            class={styles.code}
            rows={5}
            value={testValue()}
            placeholder={'{ "title": "Hello" }'}
            onInput={(event) => setTestValue(event.currentTarget.value)}
          />
          <div class={styles.formActions}>
            <Button
              label={t('feeds.test.send')}
              type="submit"
              color="primary"
              loading={sending()}
              disabled={testValue().trim() === ''}
            />
          </div>
        </form>
      </Show>
    </div>
  );

  const settingsTab = () => (
    <div class={styles.tabPanel}>
      <Show when={feed()} keyed>
        {(current) => (
          <FeedForm
            initial={formValues(current)}
            submitLabel={t('common.save')}
            saving={saving()}
            disabled={!canUpdate()}
            onSubmit={save}
          />
        )}
      </Show>
      <Show when={(feed()?.used_by || []).length > 0}>
        <h3>{t('feeds.usedBy')}</h3>
        <ul class={styles.usedBy}>
          <For each={feed()?.used_by}>
            {(playlist) => (
              <li>
                <A
                  href={`/org/${orgId()}/content/playlists?itemId=${playlist.id}`}
                >
                  {playlist.name}
                </A>{' '}
                <span class={styles.muted}>({playlist.items})</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={canDelete()}>
        <div class={styles.dangerZone}>
          <Button
            label={t('common.delete')}
            color="danger"
            onClick={() => setConfirm('delete')}
          />
        </div>
      </Show>
    </div>
  );

  return (
    <div class={styles.feedsPage}>
      <A class={styles.backLink} href={`/org/${orgId()}/feeds`}>
        <BsArrowLeft /> {t('feeds.back')}
      </A>

      <Show when={notFound()}>
        <div class={styles.emptyState}>
          <p>{t('feeds.notFound')}</p>
        </div>
      </Show>

      <Show
        when={feed()}
        fallback={<Show when={!notFound()}>{t('common.loading')}</Show>}
      >
        {(current) => (
          <>
            <div class={styles.header}>
              <div class={styles.headerText}>
                <h1>{current().name}</h1>
                <p class={styles.description}>
                  {t(`feeds.modes.${current().mode}`)}
                  <Show when={current().description}>
                    {' · '}
                    {current().description}
                  </Show>
                </p>
              </div>
            </div>
            <Tabs
              tabs={[
                { title: () => t('feeds.tabs.entries'), content: entriesTab },
                {
                  title: () => t('feeds.tabs.connect'),
                  content: () => (
                    <div class={styles.tabPanel}>
                      <FeedConnect
                        organizationId={orgId()}
                        feed={current()}
                        canManage={canUpdate()}
                      />
                    </div>
                  ),
                },
                {
                  title: () => t('feeds.tabs.media'),
                  content: () => (
                    <div class={styles.tabPanel}>
                      <FeedMedia
                        organizationId={orgId()}
                        feed={current()}
                        canRetry={canUpdate()}
                      />
                    </div>
                  ),
                },
                { title: () => t('feeds.tabs.settings'), content: settingsTab },
              ]}
            />
          </>
        )}
      </Show>

      <ConfirmDialog
        show={confirm() !== null}
        title={confirmTexts().title}
        message={confirmTexts().message}
        confirmLabel={confirmTexts().label}
        cancelLabel={t('common.cancel')}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
      />
    </div>
  );
};

export default FeedPage;
