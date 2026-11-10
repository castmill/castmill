import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';
import { A } from '@solidjs/router';
import { BsLightningCharge } from 'solid-icons/bs';
import { useI18n } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { store } from '../../store/store';
import {
  AutomationsService,
  ChannelAutomation,
  occurrenceToMs,
} from '../../services/automations.service';
import { ruleSummary } from '../automations-page/registry';
import { useSummaryContext } from '../automations-page/summary-context';
import {
  loadPlaylistNames,
  referencedPlaylistIds,
} from '../automations-page/playlist-names';
import type { CalendarMarker } from './automation-markers';
import styles from './channel-automations.module.scss';

export interface ChannelAutomationsProps {
  organizationId: string;
  channelId: number;
  timeZone: string;
  /** Visible calendar week (epoch ms). */
  range?: { start: number; end: number };
  /** Markers to draw on the calendar (empty when hidden). */
  onMarkersChange: (markers: CalendarMarker[]) => void;
}

/** Firings listed below the panel when markers are shown. */
export const MAX_LISTED_FIRINGS = 10;

/**
 * Automations assigned to a channel plus their clock firings in the visible
 * calendar week, which can be shown as markers on the weekly calendar.
 */
export const ChannelAutomations: Component<ChannelAutomationsProps> = (
  props
) => {
  const { t, locale } = useI18n();
  const { canPerformAction } = usePermissions();
  const summaryContext = useSummaryContext();

  const canList = () =>
    !store.permissions?.loaded || canPerformAction('automations', 'list');

  const [automations, setAutomations] = createSignal<ChannelAutomation[]>([]);
  const [error, setError] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const [showMarkers, setShowMarkers] = createSignal(true);
  let sequence = 0;

  createEffect(
    on(
      () =>
        [
          props.organizationId,
          props.channelId,
          props.range?.start,
          props.range?.end,
          canList(),
        ] as const,
      async ([organizationId, channelId, start, end, allowed]) => {
        if (!allowed || !organizationId || !channelId) return;
        const current = ++sequence;
        try {
          const result = await AutomationsService.channelAutomations(
            organizationId,
            channelId,
            start !== undefined && end !== undefined
              ? { from: new Date(start), to: new Date(end) }
              : {}
          );
          if (current !== sequence) return;
          setAutomations(result ?? []);
          setError(false);
          loadPlaylistNames(
            organizationId,
            referencedPlaylistIds((result ?? []).flatMap((a) => a.rules ?? []))
          );
        } catch {
          if (current !== sequence) return;
          setAutomations([]);
          setError(true);
        } finally {
          if (current === sequence) setLoaded(true);
        }
      }
    )
  );

  const firings = createMemo(() =>
    automations()
      .filter((automation) => automation.enabled)
      .flatMap((automation) =>
        (automation.occurrences ?? []).map((occurrence) => ({
          name: automation.name,
          time: occurrenceToMs(occurrence),
        }))
      )
      .filter((firing) => Number.isFinite(firing.time))
      .sort((a, b) => a.time - b.time)
  );

  const formatTime = (time: number) => {
    try {
      return new Intl.DateTimeFormat(locale(), {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: props.timeZone,
      }).format(new Date(time));
    } catch {
      return new Date(time).toLocaleString();
    }
  };

  createEffect(() => {
    props.onMarkersChange(
      showMarkers()
        ? firings().map((firing) => ({
            time: firing.time,
            label: t('automations.channel.markerLabel', {
              name: firing.name,
              time: formatTime(firing.time),
            }),
          }))
        : []
    );
  });

  return (
    <Show when={canList()}>
      <section
        class={styles.panel}
        aria-labelledby="channel-automations-title"
        data-testid="channel-automations"
      >
        <div class={styles.header}>
          <h3 id="channel-automations-title" class={styles.title}>
            <BsLightningCharge aria-hidden="true" />
            {t('automations.channel.title')}
          </h3>
          <A
            class={styles.manage}
            href={`/org/${props.organizationId}/automations`}
          >
            {t('automations.channel.manage')}
          </A>
        </div>

        <Show when={error()}>
          <p class={styles.error} role="alert">
            {t('automations.channel.loadFailed')}
          </p>
        </Show>

        <Show when={loaded() && !error() && automations().length === 0}>
          <p class={styles.muted}>{t('automations.channel.empty')}</p>
        </Show>

        <Show when={automations().length > 0}>
          <ul class={styles.list}>
            <For each={automations()}>
              {(automation) => (
                <li class={styles.item} data-testid="channel-automation">
                  <div class={styles.itemHeader}>
                    <strong>{automation.name}</strong>
                    <Show when={!automation.enabled}>
                      <span class={styles.badge}>
                        {t('automations.disabled')}
                      </span>
                    </Show>
                  </div>
                  <Show
                    when={(automation.rules ?? []).length > 0}
                    fallback={
                      <span class={styles.muted}>
                        {t('automations.noRules')}
                      </span>
                    }
                  >
                    <ul class={styles.rules}>
                      <For each={automation.rules}>
                        {(rule) => (
                          <li>{ruleSummary(rule, summaryContext())}</li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </li>
              )}
            </For>
          </ul>

          <label class={styles.toggle}>
            <input
              type="checkbox"
              checked={showMarkers()}
              onChange={(e) => setShowMarkers(e.currentTarget.checked)}
              data-testid="toggle-automation-markers"
            />
            {t('automations.channel.showMarkers')}
            <span class={styles.muted}>
              {t('automations.channel.firingsThisWeek', {
                count: firings().length,
              })}
            </span>
          </label>

          <Show when={showMarkers() && firings().length > 0}>
            <ol
              class={styles.firings}
              aria-label={t('automations.channel.upcoming')}
            >
              <For each={firings().slice(0, MAX_LISTED_FIRINGS)}>
                {(firing) => (
                  <li data-testid="channel-automation-firing">
                    <time datetime={new Date(firing.time).toISOString()}>
                      {formatTime(firing.time)}
                    </time>{' '}
                    {firing.name}
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </Show>
      </section>
    </Show>
  );
};
