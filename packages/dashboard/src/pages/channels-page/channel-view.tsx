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
  const style = `
    width: 90vw;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;`;

  return (
    <div style={style}>
      <div style="width: 100%;">
        <div class={styles.notice}>{t('channels.info.contentRequired')}</div>
        <CalendarView timeZone="Europe/Stockholm" channel={props.channel} />
      </div>
    </div>
  );
};
