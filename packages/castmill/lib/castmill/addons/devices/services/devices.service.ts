import { Device } from '../interfaces/device.interface';
import {
  SortOptions,
  FetchDataOptions,
  fetchOptionsToQueryString,
  HttpError,
} from '@castmill/ui-common';
import { DeviceCommand } from '../types/device-command.type';
import { DeviceEvent as DeviceEvent } from '../interfaces/device-event.interface';
import { DeviceUpdate } from '../components/device-details';

export interface FetchDevicesOptions {
  page: number;
  page_size: number;
  sortOptions: SortOptions;
  search?: string;
  filters?: Record<string, string | boolean>;
  team_id?: number | null;
}
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
    // Throw HttpError with status code for better error handling
    throw new HttpError(errMsg, response.status);
  }
}

export const DevicesService = {
  /**
   * Register Device.
   *
   * @returns Device
   */
  async registerDevice(
    baseUrl: string,
    organizationId: string,
    name: string,
    pincode: string
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/devices`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, pincode }),
      }
    );

    return handleResponse<Device>(response, { parse: true });
  },

  /**
   * Fetch Devices.
   *
   * @returns { page: number, data: Device[], total: number }
   */
  async fetchDevices(
    baseUrl: string,
    organizationId: string,
    {
      page,
      page_size,
      sortOptions,
      search,
      filters,
      team_id,
    }: FetchDevicesOptions
  ) {
    const filtersToString = (filters: Record<string, string | boolean>) => {
      return Object.entries(filters)
        .map(([key, value]) =>
          typeof value === 'boolean' ? `${key}` : `${key}:${value}`
        )
        .join(',');
    };

    const query = new URLSearchParams({
      direction: sortOptions.direction,
      page_size: page_size.toString(),
      page: page.toString(),
    });

    if (sortOptions.key) {
      query.set('key', sortOptions.key);
    }

    if (search) {
      query.set('search', search);
    }

    if (filters) {
      query.set('filters', filtersToString(filters));
    }

    if (team_id !== undefined && team_id !== null) {
      query.set('team_id', team_id.toString());
    }

    const queryString = query.toString();

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/devices?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: Device[]; count: number }>(response, {
      parse: true,
    });
  },

  /**
   * Send Command.
   */
  async sendCommand(baseUrl: string, deviceId: string, command: DeviceCommand) {
    const response = await fetch(
      `${baseUrl}/dashboard/devices/${deviceId}/commands`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      }
    );

    handleResponse(response);
  },

  /**
   * Get Device Logs.
   */
  async getDeviceEvents(
    baseUrl: string,
    deviceId: string,
    page: number,
    page_size: number,
    sortOptions: SortOptions,
    types?: string[]
  ) {
    const params: Record<string, string> = {
      ...sortOptions,
      page_size: page_size.toString(),
      page: page.toString(),
    };

    // Add event type filters if provided
    if (types && types.length > 0) {
      params.types = types.join(',');
    }

    const query = new URLSearchParams(params).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/devices/${deviceId}/events?${query}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: DeviceEvent[]; count: number }>(response, {
      parse: true,
    });
  },

  /**
   * Delete Device Events
   * @param baseUrl API base URL
   * @param deviceId Device ID
   * @param type Optional event type to delete ('o', 'x', 'e', 'w', 'i'). If not provided, deletes all events.
   */
  async deleteDeviceEvents(baseUrl: string, deviceId: string, type?: string) {
    const params = type ? `?type=${encodeURIComponent(type)}` : '';
    const response = await fetch(
      `${baseUrl}/dashboard/devices/${deviceId}/events${params}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ success: boolean; deleted: number }>(response, {
      parse: true,
    });
  },

  /**
   * Get Device Cache
   */
  async getDeviceCache(
    baseUrl: string,
    deviceId: string,
    {
      type,
      page,
      page_size,
      sortOptions,
      search,
      filters,
    }: FetchDevicesOptions & { type: string }
  ) {
    const query = new URLSearchParams({
      ...(sortOptions || {}),
      page_size: page_size.toString(),
      page: page.toString(),
      type: type || 'data',
    }).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/devices/${deviceId}/cache?${query}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: any[]; count: number }>(response, {
      parse: true,
    });
  },

  /**
   * Delete Device Cache Entries
   * @param baseUrl API base URL
   * @param deviceId Device ID
   * @param type Cache type ('data', 'code', 'media', or 'all' to clear everything)
   * @param urls Array of URLs to delete (empty array will delete all of the specified type)
   */
  async deleteDeviceCache(
    baseUrl: string,
    deviceId: string,
    type: string,
    urls: string[]
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/devices/${deviceId}/cache`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, urls }),
      }
    );

    return handleResponse<{ success: boolean; deleted: number }>(response, {
      parse: true,
    });
  },

  /**
   * Remove Device.
   */
  async removeDevice(
    baseUrl: string,
    organizationId: string,
    deviceId: string
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/devices/${deviceId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    handleResponse(response);
  },

  /**
   * Update Device
   * */
  async updateDevice(
    baseUrl: string,
    organizationId: string,
    deviceId: string,
    device: DeviceUpdate
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/devices/${deviceId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ update: device }),
      }
    );

    handleResponse(response);
  },

  /**
   * Get all the available channels
   */
  async fetchChannels(
    baseUrl: string,
    organizationId: string,
    opts: FetchDataOptions
  ) {
    const queryString = fetchOptionsToQueryString(opts);
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/channels?${queryString}`,
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
  },

  /**
   * Get the current channel of a device
   */
  async fetchChannelByDeviceId(baseUrl: string, deviceId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/devices/${deviceId}/channels`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch channel');
    }
  },

  /**
   * Add a channel to a device without replacing existing channels.
   * This method ensures that the specified channel is added to the device
   * while preserving any other channels already associated with it.
   *
   * @param baseUrl API base URL
   * @param deviceId Device ID
   * @param channelId Channel ID to add
   * @returns Promise that resolves when the channel is added
   */
  async addChannelToDevice(
    baseUrl: string,
    deviceId: string,
    channelId: number
  ) {
    return await addChannelToDevice(baseUrl, deviceId, channelId);
  },

  /**
   * Remove a channel from a device.
   *
   * @param baseUrl API base URL
   * @param deviceId Device ID
   * @param channelId Channel ID to remove
   * @returns Promise that resolves when the channel is removed
   */
  async removeChannelFromDevice(
    baseUrl: string,
    deviceId: string,
    channelId: number
  ) {
    return await removeChannelFromDevice(baseUrl, deviceId, channelId);
  },
};

/**
 * Adds a channel to a device.
 *
 * @param baseUrl API base URL
 * @param deviceId Device ID
 * @param channelId Channel ID to add
 * @returns Promise that resolves when the channel is added
 */
const addChannelToDevice = async (
  baseUrl: string,
  deviceId: string,
  channelId: number
) => {
  const response = await fetch(
    `${baseUrl}/dashboard/devices/${deviceId}/channels`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel_id: channelId }),
    }
  );

  return handleResponse(response);
};

/**
 * Removes a channel from a device.
 *
 * @param baseUrl API base URL
 * @param deviceId Device ID
 * @param channelId Channel ID to remove
 * @returns Promise that resolves when the channel is removed
 */
const removeChannelFromDevice = async (
  baseUrl: string,
  deviceId: string,
  channelId: number
) => {
  const response = await fetch(
    `${baseUrl}/dashboard/devices/${deviceId}/channels/${channelId}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse(response);
};

/**
 * Gets all channels of a device.
 *
 * @param baseUrl API base URL
 * @param deviceId Device ID
 * @returns Promise that resolves with the channels of the device
 */
const getChannelsOfDevice = async (baseUrl: string, deviceId: string) => {
  const response = await fetch(
    `${baseUrl}/dashboard/devices/${deviceId}/channels`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse(response, { parse: true });
};
