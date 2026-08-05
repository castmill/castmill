import { Component, For } from 'solid-js';
import { FormItem } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';

export const DeviceInfo: Component<{
  device: Device;
  t: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const value = (value?: string | null) =>
    value || props.t('common.notAvailable');

  const fields = () => [
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
      id: 'environment-version',
      label: props.t('devices.info.environmentVersion'),
      value: props.device.info?.environmentVersion,
    },
    {
      id: 'chromium-version',
      label: props.t('devices.info.chromiumVersion'),
      value: props.device.info?.chromiumVersion,
    },
    {
      id: 'v8-version',
      label: props.t('devices.info.v8Version'),
      value: props.device.info?.v8Version,
    },
    {
      id: 'node-version',
      label: props.t('devices.info.nodeVersion'),
      value: props.device.info?.nodeVersion,
    },
    {
      id: 'timezone',
      label: props.t('common.timezone'),
      value: props.device.timezone,
    },
    {
      id: 'user-agent',
      label: props.t('devices.info.userAgent'),
      value: props.device.info?.userAgent || props.device.user_agent,
    },
  ];

  return (
    <div class="form-inputs">
      <For each={fields()}>
        {(field) => (
          <FormItem
            label={field.label}
            id={field.id}
            value={value(field.value)}
            disabled={true}
            onInput={() => {}}
          />
        )}
      </For>
    </div>
  );
};
