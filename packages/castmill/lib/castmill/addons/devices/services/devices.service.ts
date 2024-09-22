import { Device } from '../interfaces/device.interface';
import { SortOptions } from '@castmill/ui-common';
import { DeviceCommand } from '../types/device-command.type';
import { DeviceEvent as DeviceEvent } from '../interfaces/device-event.interface';
import { DeviceUpdate } from '../components/device-details';

export interface FetchDevicesOptions {
  page: number;
  page_size: number;
  sortOptions: SortOptions;
  search?: string;
  filters?: Record<string, string | boolean>;
}
type HandleResponseOptions = {
  parse?: boolean;
};

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
    throw new Error(errMsg);
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
    { page, page_size, sortOptions, search, filters }: FetchDevicesOptions
  ) {
    const filtersToString = (filters: Record<string, string | boolean>) => {
      return Object.entries(filters)
        .map(([key, value]) =>
          typeof value === 'boolean' ? `${key}` : `${key}:${value}`
        )
        .join(',');
    };

    const query = {
      ...sortOptions,
      page_size: page_size.toString(),
      page: page.toString(),
    };

    if (search) {
      query['search'] = search;
    }

    if (filters) {
      query['filters'] = filtersToString(filters);
    }

    const queryString = new URLSearchParams(query).toString();

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
    const response = await fetch(`${baseUrl}/dashboard/devices/${deviceId}/commands`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

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
    sortOptions: SortOptions
  ) {
    const query = new URLSearchParams({
      ...sortOptions,
      page_size: page_size.toString(),
      page: page.toString(),
    }).toString();

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
   * Remove Device.
   */
  async removeDevice(baseUrl: string, organizationId: string, deviceId: string) {
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
};
