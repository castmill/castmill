import { ParentComponent } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconTypes } from 'solid-icons';
import {
  BsExclamationTriangle,
  BsInfoCircle,
  BsWifiOff,
  BsXOctagon,
} from 'solid-icons/bs';

export type DeviceNoticeTone = 'offline' | 'warning' | 'error' | 'info';

const NOTICE_ICONS: Record<DeviceNoticeTone, IconTypes> = {
  offline: BsWifiOff,
  warning: BsExclamationTriangle,
  error: BsXOctagon,
  info: BsInfoCircle,
};

export const DeviceNotice: ParentComponent<{ tone: DeviceNoticeTone }> = (
  props
) => (
  <div
    class={`device-notice ${props.tone}`}
    role={props.tone === 'error' ? 'alert' : 'status'}
  >
    <span class="device-notice-icon" aria-hidden="true">
      <Dynamic component={NOTICE_ICONS[props.tone]} />
    </span>
    <div class="device-notice-body">{props.children}</div>
  </div>
);

export const DeviceIconButton = (props: {
  label: string;
  icon: IconTypes;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: 'danger';
}) => (
  <button
    type="button"
    class="device-icon-button"
    classList={{ danger: props.tone === 'danger' }}
    aria-label={props.label}
    title={props.title || props.label}
    disabled={props.disabled}
    onClick={() => props.onClick()}
  >
    <Dynamic component={props.icon} />
  </button>
);

/** Table timestamp whose date and time wrap onto separate lines when narrow */
export const DeviceTableTime = (props: { value: string | number | Date }) => {
  const date = () => new Date(props.value);
  return (
    <time class="device-table-time" dateTime={date().toISOString()}>
      <span>{date().toLocaleDateString()}</span>{' '}
      <span>{date().toLocaleTimeString()}</span>
    </time>
  );
};
