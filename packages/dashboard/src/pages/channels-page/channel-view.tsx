import { JsonChannel } from '../../services/channels.service';
import { CalendarView } from './calendar-view';
import { useI18n } from '../../i18n';
import styles from './channel-view.module.scss';

export const ChannelView = (props: {
  organizationId: string;
  channel: JsonChannel;
  team?: Omit<JsonChannel, 'id'> & { id?: number };
  onSubmit?: (
    channelUpdate: Partial<JsonChannel>
  ) => Promise<JsonChannel | void>;
}) => {
  const { t } = useI18n();
  return (
    <div class={styles.channelView}>
      <div class={styles.channelContent}>
        <div class={styles.notice}>{t('channels.info.contentRequired')}</div>
        <CalendarView timeZone="Europe/Stockholm" channel={props.channel} />
      </div>
    </div>
  );
};
