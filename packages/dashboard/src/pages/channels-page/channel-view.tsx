import { JsonChannel } from '../../services/channels.service';
import { CalendarView } from './calendar-view';
import { useI18n } from '../../i18n';
import styles from './channel-view.module.scss';
import { createSignal } from 'solid-js';
import { ChannelAutomations } from './channel-automations';
import type { CalendarMarker } from './automation-markers';

export const ChannelView = (props: {
  organizationId: string;
  channel: JsonChannel;
  team?: Omit<JsonChannel, 'id'> & { id?: number };
  onSubmit?: (
    channelUpdate: Partial<JsonChannel>
  ) => Promise<JsonChannel | void>;
}) => {
  const { t } = useI18n();
  const [range, setRange] = createSignal<{ start: number; end: number }>();
  const [markers, setMarkers] = createSignal<CalendarMarker[]>([]);

  return (
    <div class={styles['channel-view']}>
      <div class={styles.content}>
        <div class={styles.notice}>{t('channels.info.contentRequired')}</div>
        <ChannelAutomations
          organizationId={props.organizationId}
          channelId={props.channel.id}
          timeZone={props.channel.timezone}
          range={range()}
          onMarkersChange={setMarkers}
        />
        <CalendarView
          timeZone={props.channel.timezone}
          channel={props.channel}
          markers={markers()}
          onWeekChange={(start, end) => {
            const current = range();
            if (current?.start !== start || current?.end !== end) {
              setRange({ start, end });
            }
          }}
        />
      </div>
    </div>
  );
};
