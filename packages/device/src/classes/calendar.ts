import { Playlist } from "@castmill/player";

/**
 * Calendar
 *
 * The calendar is responsible for scheduling the playlists to be played.
 *
 * The calendar listens to server events so that it can be updated in real time.
 *
 */
export class Calendar {
  nextPlaylist():
    | { playlist: Playlist; endTime: number; nextTimestamp: number }
    | undefined {
    return undefined;
  }
}
