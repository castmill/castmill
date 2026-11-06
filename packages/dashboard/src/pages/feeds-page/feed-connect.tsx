import { Component, For, Show, createEffect, createSignal, on } from 'solid-js';
import { BsClipboard, BsPlus } from 'solid-icons/bs';
import { Button, ConfirmDialog, Modal, useToast } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import { parseServerDate } from '../../services/agents.service';
import {
  FeedDetails,
  FeedToken,
  FeedsService,
} from '../../services/feeds.service';
import { copyToClipboard } from '../agents-page/agent-integration-instructions';

import styles from './feeds-page.module.scss';

/** A curl command that appends an entry to the feed. */
export const curlExample = (url: string, token = '<TOKEN>') =>
  [
    `curl -X POST "${url}" \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"external_id": "post-1", "title": "Hello", "image": "https://example.com/photo.jpg"}'`,
  ].join('\n');

interface FeedConnectProps {
  organizationId: string;
  feed: FeedDetails;
  canManage: boolean;
}

/** Endpoints, write tokens and examples for connecting a system to a feed. */
export const FeedConnect: Component<FeedConnectProps> = (props) => {
  const { t, formatDate } = useI18n();
  const toast = useToast();

  const [tokens, setTokens] = createSignal<FeedToken[]>([]);
  const [showCreate, setShowCreate] = createSignal(false);
  const [tokenName, setTokenName] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [secret, setSecret] = createSignal<string | null>(null);
  const [revoking, setRevoking] = createSignal<FeedToken | null>(null);

  const loadTokens = async () => {
    if (!props.canManage) return;
    try {
      setTokens(await FeedsService.tokens(props.organizationId, props.feed.id));
    } catch {
      toast.error(t('feeds.errors.loadFeed'));
    }
  };

  createEffect(
    on(
      () => props.feed.id,
      () => void loadTokens()
    )
  );

  const copy = async (text: string) => {
    if (await copyToClipboard(text)) {
      toast.success(t('feeds.connect.copied'));
    } else {
      toast.error(t('feeds.connect.copyFailed'));
    }
  };

  const createToken = async (event: Event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const result = await FeedsService.createToken(
        props.organizationId,
        props.feed.id,
        tokenName().trim()
      );
      setShowCreate(false);
      setTokenName('');
      setSecret(result.secret);
      await loadTokens();
    } catch (error: any) {
      toast.error(t('feeds.errors.action', { message: error?.message || '' }));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    const token = revoking();
    setRevoking(null);
    if (!token) return;
    try {
      await FeedsService.revokeToken(
        props.organizationId,
        props.feed.id,
        token.id
      );
      await loadTokens();
    } catch (error: any) {
      toast.error(t('feeds.errors.action', { message: error?.message || '' }));
    }
  };

  const endpoints = () => [
    {
      key: 'append',
      label: t('feeds.connect.append'),
      method: 'POST',
      url: props.feed.endpoints.append,
    },
    {
      key: 'replace',
      label: t('feeds.connect.replace'),
      method: 'PUT',
      url: props.feed.endpoints.replace,
    },
    {
      key: 'read',
      label: t('feeds.connect.read'),
      method: 'GET',
      url: props.feed.endpoints.read,
    },
  ];

  const makeSteps = ['makeStep1', 'makeStep2', 'makeStep3', 'makeStep4'];

  return (
    <div class={styles.connect}>
      <section>
        <h3>{t('feeds.connect.endpoints')}</h3>
        <For
          each={endpoints().filter(
            (endpoint) =>
              props.feed.mode === 'list' || endpoint.key !== 'append'
          )}
        >
          {(endpoint) => (
            <div class={styles.endpoint}>
              <span class={styles.endpointLabel}>{endpoint.label}</span>
              <code>
                {endpoint.method} {endpoint.url}
              </code>
              <button
                type="button"
                class={styles.iconButton}
                title={t('feeds.connect.copy')}
                aria-label={`${t('feeds.connect.copy')}: ${endpoint.label}`}
                onClick={() => copy(endpoint.url)}
              >
                <BsClipboard />
              </button>
            </div>
          )}
        </For>
      </section>

      <Show when={props.canManage}>
        <section>
          <div class={styles.sectionHeader}>
            <h3>{t('feeds.tokens.title')}</h3>
            <Button
              label={t('feeds.tokens.new')}
              icon={BsPlus}
              color="primary"
              onClick={() => setShowCreate(true)}
            />
          </div>
          <p class={styles.muted}>{t('feeds.tokens.help')}</p>
          <Show
            when={tokens().length > 0}
            fallback={<p class={styles.muted}>{t('feeds.tokens.empty')}</p>}
          >
            <ul class={styles.tokens} data-testid="feed-tokens">
              <For each={tokens()}>
                {(token) => (
                  <li classList={{ [styles.revoked]: !!token.revoked_at }}>
                    <span class={styles.tokenName}>{token.name}</span>
                    <code class={styles.secretChip}>…{token.hint}</code>
                    <span class={styles.muted}>
                      {t('feeds.tokens.lastUsed')}:{' '}
                      {token.last_used_at
                        ? formatDate(parseServerDate(token.last_used_at), 'Pp')
                        : t('feeds.never')}
                    </span>
                    <Show
                      when={!token.revoked_at}
                      fallback={
                        <span class={styles.badgeRevoked}>
                          {t('feeds.tokens.revoked')}
                        </span>
                      }
                    >
                      <Button
                        label={t('feeds.tokens.revoke')}
                        color="danger"
                        onClick={() => setRevoking(token)}
                      />
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <p class={styles.muted}>{t('feeds.tokens.memberHint')}</p>
        </section>
      </Show>

      <Show when={props.feed.mode === 'list'}>
        <section>
          <h3>{t('feeds.examples.curl')}</h3>
          <pre class={styles.snippet}>
            {curlExample(props.feed.endpoints.append)}
          </pre>
          <h3>{t('feeds.examples.make')}</h3>
          <ol class={styles.steps}>
            <For each={makeSteps}>
              {(step) => <li>{t(`feeds.examples.${step}`)}</li>}
            </For>
          </ol>
        </section>
      </Show>

      <Show when={showCreate()}>
        <Modal
          title={t('feeds.tokens.new')}
          description={t('feeds.tokens.help')}
          onClose={() => setShowCreate(false)}
        >
          <form class={styles.form} onSubmit={createToken}>
            <label class={styles.fieldLabel} for="feed-token-name">
              {t('common.name')}
            </label>
            <input
              id="feed-token-name"
              class={styles.input}
              value={tokenName()}
              placeholder={t('feeds.tokens.namePlaceholder')}
              onInput={(event) => setTokenName(event.currentTarget.value)}
            />
            <div class={styles.formActions}>
              <Button
                label={t('common.cancel')}
                color="secondary"
                onClick={() => setShowCreate(false)}
              />
              <Button
                label={t('common.create')}
                type="submit"
                color="primary"
                loading={creating()}
              />
            </div>
          </form>
        </Modal>
      </Show>

      <Show when={secret()}>
        {(value) => (
          <Modal
            title={t('feeds.tokens.secretTitle')}
            description={t('feeds.tokens.secretWarning')}
            onClose={() => setSecret(null)}
          >
            <div class={styles.secretBox}>
              <code data-testid="feed-token-secret">{value()}</code>
              <Button
                label={t('feeds.connect.copy')}
                color="primary"
                onClick={() => copy(value())}
              />
            </div>
            <Show when={props.feed.mode === 'list'}>
              <pre class={styles.snippet}>
                {curlExample(props.feed.endpoints.append, value())}
              </pre>
            </Show>
            <div class={styles.formActions}>
              <Button
                label={t('feeds.tokens.done')}
                color="primary"
                onClick={() => setSecret(null)}
              />
            </div>
          </Modal>
        )}
      </Show>

      <ConfirmDialog
        show={revoking() !== null}
        title={t('feeds.tokens.revokeTitle')}
        message={t('feeds.tokens.revokeMessage', {
          name: revoking()?.name || '',
        })}
        confirmLabel={t('feeds.tokens.revoke')}
        cancelLabel={t('common.cancel')}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
      />
    </div>
  );
};
