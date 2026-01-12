import { JsonChannel } from '../../services/channels.service';
import { CalendarView } from './calendar-view';

export const ChannelView = (props: {
  organizationId: string;
  channel: JsonChannel;
  team?: Omit<JsonChannel, 'id'> & { id?: number };
  onSubmit?: (
    channelUpdate: Partial<JsonChannel>
  ) => Promise<JsonChannel | void>;
}) => {
  const style = `
    width: 90vw;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;`;

  return (
    <div style={style}>
      <CalendarView timeZone="Europe/Stockholm" channel={props.channel} />
    </div>
  );
};
