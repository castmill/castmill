import {
  JsonPlaylist,
  JsonWidget,
  JsonWidgetConfig,
  JsonPlaylistItem,
} from '@castmill/player';

import { SortOptions, HttpError } from '@castmill/ui-common';

export interface FetchPlaylistsOptions {
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

export interface PlaylistUpdate {
  name: string;
  description: string;
  settings?: {
    aspect_ratio?: {
      width: number;
      height: number;
    };
  };
}

interface PlaylistItemInsertPayload {
  widget_id: number;
  offset: number;
  duration?: number;
  options: Record<string, any>;
  prev_item_id?: number;
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
    let errorData: any = null;
    try {
      const jsonResponse = await response.json();
      errorData = jsonResponse.errors;
      errMsg = `${errorData.detail || response.statusText}`;
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    // Throw HttpError with status code and error data for better error handling
    const httpError = new HttpError(errMsg, response.status);
    // Attach additional error data (like channels list) to the error object
    (httpError as any).errorData = errorData;
    throw httpError;
  }
}

export const PlaylistsService = {
  /**
   * Adds a playlist.
   *
   * @returns JsonPlaylist
   */
  async addPlaylist(
    baseUrl: string,
    organizationId: string,
    name: string,
    aspectRatio?: { width: number; height: number },
    teamId?: number | null
  ) {
    const playlistData: {
      name: string;
      team_id?: number;
      settings?: {
        aspect_ratio?: { width: number; height: number };
      };
    } = { name };

    if (teamId !== null && teamId !== undefined) {
      playlistData.team_id = teamId;
    }

    if (aspectRatio) {
      playlistData.settings = {
        aspect_ratio: aspectRatio,
      };
    }

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playlist: playlistData }),
      }
    );

    return handleResponse<{ data: JsonPlaylist }>(response, { parse: true });
  },

  /**
   * Fetch Playlists.
   *
   * @returns { page: number, data: JsonPlaylist[], total: number }
   */
  async fetchPlaylists(
    baseUrl: string,
    organizationId: string,
    {
      page,
      page_size,
      sortOptions,
      search,
      filters,
      team_id,
    }: FetchPlaylistsOptions
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
    } as Record<string, string>;

    if (search) {
      query['search'] = search;
    }

    if (filters) {
      query['filters'] = filtersToString(filters);
    }

    if (team_id !== undefined && team_id !== null) {
      query['team_id'] = team_id.toString();
    }

    const queryString = new URLSearchParams(query).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists?${queryString}`,
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
  },

  async getPlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: number
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { data } = await handleResponse<{ data: JsonPlaylist }>(response, {
      parse: true,
    });
    return data;
  },

  /**
   * Insert widget into playlist
   */
  async insertWidgetIntoPlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: number,
    item: PlaylistItemInsertPayload
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}/items`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      }
    );

    const { data } = await handleResponse<{
      data: { id: number; widget_config_id: string };
    }>(response, {
      parse: true,
    });
    return data;
  },

  async removeItemFromPlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: number,
    itemId: number
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}/items/${itemId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse(response);
  },

  async updateItemInPlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: number,
    itemId: number,
    options: Partial<JsonPlaylistItem>
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}/items/${itemId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ options }),
      }
    );

    return handleResponse(response);
  },

  async updateWidgetConfig(
    baseUrl: string,
    organizationId: string,
    playlistId: number,
    itemId: number,
    config: Omit<JsonWidgetConfig, 'id' | 'widget_id'>
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}/items/${itemId}/config`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      }
    );

    return handleResponse(response);
  },

  async moveItemInPlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: number,
    itemId: number,
    targetId: number | null
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}/items/${itemId}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_id: targetId }),
      }
    );

    return handleResponse(response);
  },

  /**
   * Remove Playlist
   */
  async removePlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: number
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    await handleResponse(response);
  },

  /**
   * Update playlist
   * */
  async updatePlaylist(
    baseUrl: string,
    organizationId: string,
    playlistId: string,
    playlist: PlaylistUpdate
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists/${playlistId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ update: playlist }),
      }
    );

    await handleResponse(response);
  },

  async getWidgets(baseUrl: string, organizationId: string, search?: string) {
    const query: Record<string, string> = {};

    if (search) {
      query['search'] = search;
    }

    const queryString = new URLSearchParams(query).toString();
    const url = `${baseUrl}/dashboard/organizations/${organizationId}/widgets${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse<{ data: JsonWidget[]; count: number }>(response, {
      parse: true,
    });
  },

  /**
   * Check if a widget's integration credentials are configured.
   *
   * @param baseUrl - The base URL of the server
   * @param organizationId - The organization ID
   * @param widgetId - The widget ID to check
   * @returns Promise with credentials status
   */
  async checkWidgetCredentials(
    baseUrl: string,
    organizationId: string,
    widgetId: number
  ): Promise<{
    configured: boolean;
    missing_integrations: string[];
  }> {
    const url = `${baseUrl}/dashboard/organizations/${organizationId}/widgets/${widgetId}/credentials-status`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await handleResponse<{
      data: {
        configured: boolean;
        missing_integrations: string[];
      };
    }>(response, { parse: true });

    return result.data;
  },
};
