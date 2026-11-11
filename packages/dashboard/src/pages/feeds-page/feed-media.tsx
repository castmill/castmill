import { Component, For, Show, createSignal, onMount } from 'solid-js';
import { BsArrowClockwise, BsCameraVideo, BsImage } from 'solid-icons/bs';
import { Button, formatBytes, useToast } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import {
  FeedDetails,
  FeedMedia as FeedMediaItem,
  FeedsService,
} from '../../services/feeds.service';

import styles from './feeds-page.module.scss';

const KNOWN_FAILURES = [
  'not_found',
  'forbidden',
  'unauthorized',
  'too_large',
  'unsupported_type',
  'quota_exceeded',
  'timeout',
  'blocked_host',
];

export const copiesMedia = (feed: FeedDetails) =>
  (feed.media_fields || []).some((field) => (field.mode || 'copy') === 'copy');

interface FeedMediaProps {
  organizationId: string;
  feed: FeedDetails;
  canRetry: boolean;
}

/** The images and videos copied from a feed's entries. */
export const FeedMedia: Component<FeedMediaProps> = (props) => {
  const { t } = useI18n();
  const toast = useToast();
  const [items, setItems] = createSignal<FeedMediaItem[] | null>(null);
  const [storage, setStorage] = createSignal(0);

  const load = async () => {
    try {
      const result = await FeedsService.media(
        props.organizationId,
        props.feed.id
      );
      setItems(result.data);
      setStorage(result.storage);
    } catch {
      toast.error(t('feeds.media.errors.load'));
    }
  };

  onMount(() => void load());

  const retry = async (item: FeedMediaItem) => {
    try {
      await FeedsService.retryMedia(
        props.organizationId,
        props.feed.id,
        item.id
      );
      toast.success(t('feeds.media.retried'));
      await load();
    } catch (error: any) {
      toast.error(t('feeds.errors.action', { message: error?.message || '' }));
    }
  };

  const failure = (reason?: string | null) =>
    t(
      `feeds.media.failures.${
        reason && KNOWN_FAILURES.includes(reason) ? reason : 'other'
      }`
    );

  const details = (item: FeedMediaItem) =>
    [
      item.size != null ? formatBytes(item.size) : null,
      item.width && item.height ? `${item.width} × ${item.height}` : null,
      item.duration != null
        ? t('feeds.media.seconds', { seconds: Math.round(item.duration) })
        : null,
      t('feeds.media.entries', { count: item.entries }),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div class={styles.connect}>
      <p class={styles.muted}>{t('feeds.media.help')}</p>
      <div class={styles.sectionHeader}>
        <span class={styles.muted} data-testid="feed-media-storage">
          {t('feeds.media.storage', { size: formatBytes(storage()) })}
        </span>
        <Button
          label={t('feeds.refresh')}
          icon={BsArrowClockwise}
          color="secondary"
          onClick={() => void load()}
        />
      </div>

      <Show when={items()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <p class={styles.muted}>
                {copiesMedia(props.feed)
                  ? t('feeds.media.empty')
                  : t('feeds.media.noFields')}
              </p>
            }
          >
            <ul class={styles.mediaList} data-testid="feed-media">
              <For each={list()}>
                {(item) => (
                  <li class={styles.mediaItem}>
                    <div class={styles.mediaThumb}>
                      <Show
                        when={
                          item.status === 'ready' &&
                          item.url &&
                          item.content_type?.startsWith('image/')
                        }
                        fallback={
                          item.content_type?.startsWith('video/') ? (
                            <BsCameraVideo />
                          ) : (
                            <BsImage />
                          )
                        }
                      >
                        <img src={item.url!} alt="" loading="lazy" />
                      </Show>
                    </div>
                    <div class={styles.mediaText}>
                      <div class={styles.entryHeader}>
                        <span class={styles.mediaHost}>
                          {item.original_host || '—'}
                        </span>
                        <span
                          class={styles.mediaStatus}
                          data-status={item.status}
                        >
                          {t(`feeds.media.status.${item.status}`)}
                        </span>
                      </div>
                      <span class={styles.muted}>{details(item)}</span>
                      <Show when={item.status === 'failed'}>
                        <span class={styles.error}>
                          {failure(item.failure_reason)}
                        </span>
                      </Show>
                    </div>
                    <Show when={props.canRetry && item.status === 'failed'}>
                      <Button
                        label={t('feeds.media.retry')}
                        color="secondary"
                        onClick={() => void retry(item)}
                      />
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>
    </div>
  );
};
