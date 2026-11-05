import { Component, For, JSX, Show, createSignal, onCleanup } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconTypes } from 'solid-icons';
import {
  BsActivity,
  BsCalendar3,
  BsCheck2,
  BsClipboard,
  BsCollectionPlay,
  BsEye,
  BsGrid1x2,
  BsHddStack,
  BsListUl,
  BsTools,
} from 'solid-icons/bs';
import {
  LoadingOverlay,
  formatRelativeTimeLocalized,
  useToast,
} from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { Channels } from './channels';
import { Maintainance } from './maintainance';
import { DeviceLogs } from './device-events';
import { DeviceDetails, DeviceUpdate } from './device-details';
import { DevicesService } from '../services/devices.service';
import { DeviceCache } from './device-cache';
import { DevicePreview } from './device-preview';
import { DeviceTelemetry } from './device-telemetry';
import { DeviceSchedule } from './device-schedule';
import { DeviceInfo } from './device-info';
import { AddonStore } from '../../common/interfaces/addon-store';
import './device-view.scss';

interface DeviceSection {
  id: string;
  title: () => string;
  icon: IconTypes;
  content: () => JSX.Element;
}

const COPY_FEEDBACK_MS = 2000;
const LAST_SEEN_REFRESH_MS = 30_000;

const DeviceView: Component<{
  baseUrl: string;
  device: Device;
  organization_id: string;
  store?: AddonStore;
  onChange?: (device: Device) => void;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);

  const toast = useToast();
  const [loading, setLoading] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [copied, setCopied] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());
  const lastSeenTimer = setInterval(
    () => setNow(Date.now()),
    LAST_SEEN_REFRESH_MS
  );
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    clearTimeout(copyTimer);
    clearInterval(lastSeenTimer);
  });

  const updateDevice = async (device: DeviceUpdate) => {
    setLoading(true);

    try {
      const [updatedDevice] = await Promise.all([
        DevicesService.updateDevice(
          props.baseUrl,
          props.organization_id,
          props.device.id,
          device
        ),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);
      const report = props.device.orientation_status;
      props.onChange?.({
        ...updatedDevice,
        ...(report?.orientation === updatedDevice.orientation
          ? { orientation_status: report }
          : {}),
      });
      toast.success(t('devices.orientation.saved'));
      return true;
    } catch (err) {
      toast.error(t('devices.orientation.saveError'));
      console.error('Error updating device:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const lastSeen = () => {
    if (props.device.online) return '';
    if (!props.device.last_online) return t('devices.details.neverSeen');
    now();
    return t('devices.details.lastSeen', {
      time: formatRelativeTimeLocalized(
        props.device.last_online,
        props.store?.i18n?.locale()
      ),
    });
  };

  const summaryChips = () =>
    [
      props.device.info?.appType,
      props.device.info?.appVersion || props.device.version,
      props.device.info?.capabilities?.orientation
        ? `${props.device.orientation ?? 0}°`
        : undefined,
    ].filter(Boolean) as string[];

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(props.device.id);
      setCopied(true);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      toast.error(t('devices.details.copyFailed'));
    }
  };

  const sections: DeviceSection[] = [
    {
      id: 'overview',
      title: () => t('devices.details.overview'),
      icon: BsGrid1x2,
      content: () => (
        <div class="device-overview">
          <DeviceDetails
            device={props.device}
            store={props.store}
            onSubmit={updateDevice}
            t={t}
          />
          <DeviceInfo device={props.device} t={t} />
        </div>
      ),
    },
    {
      id: 'channels',
      title: () => t('common.channels'),
      icon: BsCollectionPlay,
      content: () => (
        <Channels
          baseUrl={props.baseUrl}
          organizationId={props.organization_id}
          device={props.device}
          store={props.store}
          t={t}
        />
      ),
    },
    {
      id: 'schedule',
      title: () => t('devices.details.schedule'),
      icon: BsCalendar3,
      content: () => (
        <DeviceSchedule baseUrl={props.baseUrl} device={props.device} t={t} />
      ),
    },
    {
      id: 'preview',
      title: () => t('common.preview'),
      icon: BsEye,
      content: () => (
        <DevicePreview baseUrl={props.baseUrl} device={props.device} t={t} />
      ),
    },
    {
      id: 'telemetry',
      title: () => t('common.telemetry'),
      icon: BsActivity,
      content: () => (
        <DeviceTelemetry baseUrl={props.baseUrl} device={props.device} t={t} />
      ),
    },
    {
      id: 'events',
      title: () => t('common.events'),
      icon: BsListUl,
      content: () => (
        <DeviceLogs baseUrl={props.baseUrl} device={props.device} t={props.t} />
      ),
    },
    {
      id: 'cache',
      title: () => t('common.cache'),
      icon: BsHddStack,
      content: () => (
        <DeviceCache
          baseUrl={props.baseUrl}
          device={props.device}
          t={props.t}
        />
      ),
    },
    {
      id: 'maintenance',
      title: () => t('common.maintainance'),
      icon: BsTools,
      content: () => (
        <Maintainance
          baseUrl={props.baseUrl}
          organizationId={props.organization_id}
          device={props.device}
          onDeviceUpdated={(device) => {
            props.onChange?.({ ...props.device, ...device });
          }}
          t={t}
        />
      ),
    },
  ];

  const tabId = (index: number) => `device-${props.device.id}-tab-${index}`;
  const panelId = () => `device-${props.device.id}-panel`;
  const tabRefs: HTMLButtonElement[] = [];

  const selectSection = (index: number, focus = false) => {
    setActiveIndex(index);
    const tab = tabRefs[index];
    if (focus) tab?.focus();
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const onTabKeyDown = (event: KeyboardEvent) => {
    const last = sections.length - 1;
    const rtl =
      (event.currentTarget as HTMLElement).closest('[dir="rtl"]') !== null;
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[
      event.key as 'ArrowRight' | 'ArrowLeft'
    ];
    let next: number | undefined;
    if (step) next = (activeIndex() + step + sections.length) % sections.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === undefined) return;
    event.preventDefault();
    selectSection(next, true);
  };

  return (
    <div class="device-view">
      <section class="device-summary" aria-label={t('common.status')}>
        <div class="device-summary-status">
          <span
            class="device-status-pill"
            classList={{
              online: props.device.online,
              offline: !props.device.online,
            }}
          >
            <span class="device-status-dot" aria-hidden="true" />
            {props.device.online ? t('common.online') : t('common.offline')}
          </span>
          <Show when={lastSeen()}>
            <span class="device-summary-seen">{lastSeen()}</span>
          </Show>
        </div>

        <div class="device-summary-meta">
          <For each={summaryChips()}>
            {(chip) => <span class="device-summary-chip">{chip}</span>}
          </For>
          <button
            type="button"
            class="device-summary-id"
            onClick={copyId}
            title={t('devices.details.copyId')}
            aria-label={t('devices.details.copyId')}
          >
            <span class="device-summary-id-label">{t('common.id')}</span>
            <code>{props.device.id}</code>
            <Show when={copied()} fallback={<BsClipboard aria-hidden="true" />}>
              <BsCheck2 aria-hidden="true" />
            </Show>
          </button>
          <span class="visually-hidden" aria-live="polite">
            {copied() ? t('devices.details.copied') : ''}
          </span>
        </div>
      </section>

      <nav class="device-sections">
        <div
          class="device-sections-list"
          role="tablist"
          aria-label={t('devices.details.sections')}
        >
          <For each={sections}>
            {(section, index) => (
              <button
                ref={(el) => (tabRefs[index()] = el)}
                type="button"
                role="tab"
                id={tabId(index())}
                class="device-section-tab"
                classList={{ active: activeIndex() === index() }}
                aria-selected={activeIndex() === index()}
                aria-controls={panelId()}
                tabIndex={activeIndex() === index() ? 0 : -1}
                title={section.title()}
                onClick={() => selectSection(index())}
                onKeyDown={onTabKeyDown}
              >
                <Dynamic component={section.icon} aria-hidden="true" />
                <span class="device-section-label">{section.title()}</span>
              </button>
            )}
          </For>
        </div>
      </nav>

      <div
        class="device-section-panel"
        role="tabpanel"
        id={panelId()}
        aria-labelledby={tabId(activeIndex())}
      >
        {sections[activeIndex()].content()}
      </div>
      <LoadingOverlay show={loading()} />
    </div>
  );
};

export default DeviceView;
