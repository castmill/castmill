import { Component, For } from 'solid-js';
import { formatTimestamp } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';

interface InfoField {
  id: string;
  label: string;
  value?: string | null;
  optional?: boolean;
  wide?: boolean;
}

export const DeviceInfo: Component<{
  device: Device;
  t: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const date = (value?: Date | string | null) =>
    value ? formatTimestamp(value) : undefined;

  const fields = (): InfoField[] => [
    {
      id: 'platform',
      label: props.t('devices.info.platform'),
      value: props.device.info?.appType,
    },
    {
      id: 'player-version',
      label: props.t('devices.info.playerVersion'),
      value: props.device.info?.appVersion || props.device.version,
    },
    {
      id: 'operating-system',
      label: props.t('devices.info.operatingSystem'),
      value: props.device.info?.os,
    },
    {
      id: 'hardware',
      label: props.t('devices.info.hardware'),
      value: props.device.info?.hardware,
    },
    {
      id: 'timezone',
      label: props.t('common.timezone'),
      value: props.device.timezone,
    },
    {
      id: 'last-ip',
      label: props.t('common.ip'),
      value: props.device.last_ip,
    },
    {
      id: 'environment-version',
      label: props.t('devices.info.environmentVersion'),
      value: props.device.info?.environmentVersion,
      optional: true,
    },
    {
      id: 'chromium-version',
      label: props.t('devices.info.chromiumVersion'),
      value: props.device.info?.chromiumVersion,
      optional: true,
    },
    {
      id: 'v8-version',
      label: props.t('devices.info.v8Version'),
      value: props.device.info?.v8Version,
      optional: true,
    },
    {
      id: 'node-version',
      label: props.t('devices.info.nodeVersion'),
      value: props.device.info?.nodeVersion,
      optional: true,
    },
    {
      id: 'added-on',
      label: props.t('common.addedOn'),
      value: date(props.device.inserted_at),
    },
    {
      id: 'updated-on',
      label: props.t('common.lastUpdatedOn'),
      value: date(props.device.updated_at),
    },
    {
      id: 'user-agent',
      label: props.t('devices.info.userAgent'),
      value: props.device.info?.userAgent || props.device.user_agent,
      wide: true,
    },
  ];

  return (
    <section class="device-card device-info">
      <header class="device-card-header">
        <h3>{props.t('devices.info.title')}</h3>
      </header>
      <dl class="device-info-list">
        <For each={fields().filter((field) => field.value || !field.optional)}>
          {(field) => (
            <div
              class="device-info-item"
              classList={{ wide: field.wide, missing: !field.value }}
              data-field={field.id}
            >
              <dt>{field.label}</dt>
              <dd>{field.value || props.t('common.notAvailable')}</dd>
            </div>
          )}
        </For>
      </dl>
    </section>
  );
};
