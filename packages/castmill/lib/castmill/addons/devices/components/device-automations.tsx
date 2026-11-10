import {
  Component,
  For,
  Show,
  createMemo,
  createSignal,
  onMount,
} from 'solid-js';
import { BsArrowClockwise, BsLightningCharge } from 'solid-icons/bs';
import { Device } from '../interfaces/device.interface';
import {
  DeviceAutomation,
  DeviceAutomationRule,
  DeviceAutomationsPayload,
  DevicesService,
} from '../services/devices.service';
import {
  DeviceCardHeader,
  DeviceIconButton,
  DeviceNotice,
} from './device-section';
import './device-automations.scss';

type Translate = (key: string, params?: Record<string, any>) => string;

/** Number of upcoming firings listed (across all automations). */
export const MAX_UPCOMING_FIRINGS = 10;

export interface UpcomingFiring {
  time: number;
  automation: string;
  rule: DeviceAutomationRule;
}

/** Next firings of all clock rules, sorted, starting at `now`. */
export const upcomingFirings = (
  automations: DeviceAutomation[],
  now: number,
  limit = MAX_UPCOMING_FIRINGS
): UpcomingFiring[] =>
  automations
    .flatMap((automation) =>
      (automation.rules ?? []).flatMap((rule) =>
        (rule.source_payload?.occurrences ?? [])
          .filter((time) => Number.isFinite(time) && time >= now)
          .map((time) => ({ time, automation: automation.name, rule }))
      )
    )
    .sort((a, b) => a.time - b.time)
    .slice(0, limit);

/** Translates `key`, falling back when the key is missing. */
const translateOr = (t: Translate, key: string, fallback: string) => {
  const value = t(key);
  return value && value !== key ? value : fallback;
};

/** Plain-language summary of a device rule ("Clock → Interrupt …"). */
export const deviceRuleSummary = (rule: DeviceAutomationRule, t: Translate) => {
  const source = translateOr(
    t,
    `automations.sources.${rule.source}.label`,
    rule.source
  );
  return `${source} → ${deviceActionSummary(rule, t)}`;
};

export const deviceActionSummary = (
  rule: DeviceAutomationRule,
  t: Translate
) => {
  if (rule.action !== 'interrupt') {
    return translateOr(
      t,
      `automations.actions.${rule.action}.label`,
      rule.action
    );
  }
  const config = rule.action_config ?? {};
  const playlist = config.playlist_id
    ? t('automations.summary.playlistFallback', { id: config.playlist_id })
    : t('automations.summary.noPlaylist');
  const parts = [
    config.start === 'immediately'
      ? t('automations.summary.interruptImmediately', { playlist })
      : t('automations.summary.interruptAfterItem', { playlist }),
  ];
  if (Number(config.plays) > 1) {
    parts.push(t('automations.summary.plays', { count: config.plays }));
  }
  if (config.priority === 'high') {
    parts.push(t('automations.summary.highPriority'));
  }
  return parts.join(' · ');
};

const viaLabel = (
  via: DeviceAutomation['via'][number],
  t: Translate
): string =>
  via.type === 'channel'
    ? t('automations.device.viaChannel', {
        name: via.name || `#${via.id ?? ''}`,
      })
    : t('automations.device.viaDevice');

export const DeviceAutomations: Component<{
  baseUrl: string;
  device: Device;
  t?: Translate;
}> = (props) => {
  const t: Translate = (key, params) => (props.t ? props.t(key, params) : key);

  const [payload, setPayload] = createSignal<DeviceAutomationsPayload>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await DevicesService.getDeviceAutomations(
        props.baseUrl,
        props.device.id
      );
      setPayload(result.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  onMount(load);

  const timeZone = () => payload()?.timezone || undefined;
  const automations = () => payload()?.automations ?? [];
  const firings = createMemo(() => upcomingFirings(automations(), Date.now()));

  const formatTime = (time: number) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    try {
      return new Intl.DateTimeFormat(undefined, {
        ...options,
        timeZone: timeZone(),
      }).format(new Date(time));
    } catch {
      return new Intl.DateTimeFormat(undefined, options).format(new Date(time));
    }
  };

  return (
    <div class="device-automations">
      <section class="device-card">
        <DeviceCardHeader
          icon={BsLightningCharge}
          title={t('automations.device.title')}
          description={t('automations.device.description')}
          count={payload() ? automations().length : undefined}
          actions={
            <DeviceIconButton
              icon={BsArrowClockwise}
              label={t('automations.device.refresh')}
              disabled={loading()}
              onClick={load}
            />
          }
        />

        <Show when={error()}>
          <DeviceNotice tone="error">
            <p>{t('automations.device.loadFailed')}</p>
          </DeviceNotice>
        </Show>

        <Show
          when={automations().length > 0}
          fallback={
            <Show when={payload() && !error()}>
              <p class="device-empty">{t('automations.device.empty')}</p>
            </Show>
          }
        >
          <ul class="device-automations-list">
            <For each={automations()}>
              {(automation) => (
                <li
                  class="device-automations-item"
                  data-testid="device-automation"
                >
                  <div class="device-automations-item-header">
                    <strong>{automation.name}</strong>
                    <For each={automation.via ?? []}>
                      {(via) => (
                        <span class="device-automations-via">
                          {viaLabel(via, t)}
                        </span>
                      )}
                    </For>
                  </div>
                  <ul class="device-automations-rules">
                    <For each={automation.rules ?? []}>
                      {(rule) => <li>{deviceRuleSummary(rule, t)}</li>}
                    </For>
                  </ul>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>

      <Show when={automations().length > 0}>
        <section class="device-card">
          <DeviceCardHeader
            title={t('automations.device.upcoming')}
            description={
              timeZone()
                ? t('automations.device.timezoneNote', {
                    timezone: timeZone(),
                  })
                : undefined
            }
          />
          <Show
            when={firings().length > 0}
            fallback={
              <p class="device-empty">{t('automations.device.noUpcoming')}</p>
            }
          >
            <ol class="device-automations-firings">
              <For each={firings()}>
                {(firing) => (
                  <li data-testid="device-automation-firing">
                    <time dateTime={new Date(firing.time).toISOString()}>
                      {formatTime(firing.time)}
                    </time>
                    <span class="device-automations-firing-name">
                      {firing.automation}
                    </span>
                    <span class="device-automations-firing-action">
                      {deviceActionSummary(firing.rule, t)}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </section>
      </Show>
    </div>
  );
};
