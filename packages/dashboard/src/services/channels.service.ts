import { JsonPlaylist } from '@castmill/player';
import {
  FetchDataOptions,
  fetchOptionsToQueryString,
} from '@castmill/ui-common';

type HandleResponseOptions = {
  parse?: boolean;
};

export interface JsonChannelEntry {
  id: number;
  name: string;
  start: number;
  end: number;
  playlist_id: number;
  inserted_at: string;
  updated_at: string;
  repeat_weekly_until: number;
}

export interface JsonChannel {
  id: number;
  organization_id: string;
  name: string;
  timezone: string;

  default_playlist_id: number;
  entries: JsonChannelEntry[];
}

async function handleResponse<T = any>(
  response: Response,
  options: { parse: true }
): Promise<T>;
async function handleResponse<T = any>(
  response: Response,
  options?: { parse?: false }
): Promise<void>;
async function handleResponse<T = any>(
  response: Response,
  options: HandleResponseOptions = {}
): Promise<T | void> {
  if (response.status >= 200 && response.status < 300) {
    if (options.parse) {
      return (await response.json()) as T;
    }
  } else {
    let errMsg = '';
    try {
      const { errors } = await response.json();
      errMsg = `${errors.detail || response.statusText}`;
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    alert(errMsg);
    throw new Error(errMsg);
  }
}

export class ChannelsService {
  constructor(
    private baseUrl: string,
    private organizationId: string
  ) {}

  /**
   * Fetch Playlists.
   *
   * @returns { page: number, data: JsonPlaylist[], total: number }
   */
  async fetchPlaylists(fetchDataOptions: FetchDataOptions) {
    const queryString = fetchOptionsToQueryString(fetchDataOptions);
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/playlists?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: JsonPlaylist[]; count: number }>(response, {
      parse: true,
    });
  }

  /**
   * Fetch Playlist.
   */
  async fetchPlaylist(playlistId: number): Promise<{ data: JsonPlaylist }> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/playlists/${playlistId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: JsonPlaylist }>(response, { parse: true });
  }

  /**
   * Adds a Channel.
   *
   * @returns Channel
   */
  async addChannel(name: string, timezone: string) {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: { name, timezone } }),
      }
    );

    return handleResponse<{ data: JsonChannel }>(response, { parse: true });
  }

  /**
   * Fetch Channels.
   *
   * @returns { page: number, data: JsonPlaylist[], total: number }
   */
  async fetchChannels(opts: FetchDataOptions) {
    const queryString = fetchOptionsToQueryString(opts);
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch channels');
    }
  }

  async getChannel(channelId: number): Promise<JsonChannel> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channelId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { data } = await handleResponse<{ data: JsonChannel }>(response, {
      parse: true,
    });
    return data;
  }

  async getChannelEntries(
    channelId: number,
    startDate: number,
    endDate: number
  ) {
    const query = new URLSearchParams({
      start_date: Math.round(startDate).toString(),
      end_date: Math.round(endDate).toString(),
    });

    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channelId}/entries?${query}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const entries = await handleResponse<JsonChannelEntry[]>(response, {
      parse: true,
    });
    return entries;
  }

  /**
   * Insert widget into playlist
   */
  async addEntryToChannel(channelId: number, item: Partial<JsonChannelEntry>) {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channelId}/entries`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      }
    );

    const { data } = await handleResponse<{ data: { id: number } }>(response, {
      parse: true,
    });
    return data;
  }

  async removeEntryFromChannel(channelId: number, entryId: number) {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channelId}/entries/${entryId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse(response);
  }

  async updateChannelEntry(
    channelId: number,
    entryId: number,
    update: Record<string, any>
  ) {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channelId}/entries/${entryId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(update),
      }
    );

    return handleResponse(response);
  }

  /**
   * Remove Channel
   */
  async removeChannel(channelId: number) {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channelId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    handleResponse(response);
  }

  /**
   * Update playlist
   * */
  async updateChannel(channel: Partial<JsonChannel>) {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${this.organizationId}/channels/${channel.id}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ update: channel }),
      }
    );

    handleResponse(response);
  }
}
