/**
 * Channel
 *
 * The channel is responsible for scheduling the playlists to be played.
 *
 */

export interface JsonChannel {
  id?: string;
  name: string;
  description: string | undefined;
  timezone: string;
  entries?: ChannelEntry[];
  default_playlist_id?: string;
  updated_at?: number;
  inserted_at?: number;
}
export class Channel {
  sortedEntries: ChannelEntry[];
  constructor(public attrs: JsonChannel) {
    this.sortedEntries = attrs.entries
      ? attrs.entries.sort((a, b) => a.start - b.start)
      : [];
  }

  /**
   *
   * @returns The playlist to be played at the current timestamp or undefined if there is no playlist to be played.
   */
  getPlaylistAt(
    timestamp: number
  ):
    | { playlist: string; endTime: number; nextTime: number | undefined }
    | undefined {
    for (let i = this.sortedEntries.length - 1; i >= 0; i--) {
      const entry = this.sortedEntries[i];
      if (
        entry.start <= timestamp &&
        (timestamp < entry.end ||
          (entry.repeat_weekly_until && entry.repeat_weekly_until >= timestamp))
      ) {
        const entryStart = new Date(entry.start);
        const entryEnd = new Date(entry.end);
        const timestampDate = new Date(timestamp);

        const timestampDay = timestampDate.getUTCDay();

        const isBetweenDays =
          timestampDay >= entryStart.getUTCDay() &&
          timestampDay <= entryEnd.getUTCDay();

        if (isBetweenDays) {
          const entryStartHours = entryStart.getUTCHours();
          const entryStartMinutes = entryStart.getUTCMinutes();
          const entryEndHours = entryEnd.getUTCHours();
          const entryEndMinutes = entryEnd.getUTCMinutes();
          const timestampHours = timestampDate.getUTCHours();
          const timestampMinutes = timestampDate.getUTCMinutes();

          const isWithinTime =
            (timestampHours > entryStartHours ||
              (timestampHours === entryStartHours &&
                timestampMinutes >= entryStartMinutes)) &&
            (timestampHours < entryEndHours ||
              (timestampHours === entryEndHours &&
                timestampMinutes <= entryEndMinutes));

          if (isWithinTime) {
            return {
              playlist: entry.playlist_id,
              endTime: entry.end,
              nextTime:
                i + 1 < this.sortedEntries.length
                  ? this.sortedEntries[i + 1].start
                  : undefined,
            };
          }
        }
      }
    }

    return this.attrs.default_playlist_id
      ? {
          playlist: this.attrs.default_playlist_id,
          endTime: Infinity,
          nextTime: undefined,
        }
      : undefined;
  }
}

/**
 * ChannelEntry
 *
 * A channel entry is a single entry in the channel. It defines a start and end date, and a playlist to be played
 * during that time.
 *
 * The entries start and end dates are in UTC time, and define a time range in a particular way:
 * The start field represents the start date and time of the entry. If the end date is another day, the range will
 * use the start field time as the start time, and the end field time as the end time. If the end date is the same
 * day, the range will use the start field time as the start time, and the end field time as the end time.
 *
 * The start and end date must always be in the same week.
 *
 * If the entry is a recurring entry, it will also define a repeatWeekelyUntil date.
 */
interface ChannelEntry {
  start: number;
  end: number;
  playlist_id: string;
  channel_id: string;
  repeat_weekly_until: number | undefined;
}
