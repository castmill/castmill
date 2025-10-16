import { JsonMedia } from '@castmill/player';
import { SortOptions, HttpError } from '@castmill/ui-common';

export interface FetchMediasOptions {
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

export interface MediasUpdate {
  name: string;
  description: string;
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

export const MediasService = {
  /**
   * Uploads a media file.
   *
   * @returns JsonPlaylist
   */
  async uploadMedia(baseUrl: string, organizationId: string, name: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/playlists`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    );

    return handleResponse<JsonMedia>(response, { parse: true });
  },

  /**
   * Fetch Medias.
   *
   * @returns { page: number, data: JsonPlaylist[], total: number }
   */
  async fetchMedias(
    baseUrl: string,
    organizationId: string,
    { page, page_size, sortOptions, search, filters, team_id }: FetchMediasOptions
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
      `${baseUrl}/dashboard/organizations/${organizationId}/medias?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: JsonMedia[]; count: number }>(response, {
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

    const { data } = await handleResponse<{ data: JsonMedia }>(response, {
      parse: true,
    });
    return data;
  },

  /**
   * Remove Media
   */
  async removeMedia(baseUrl: string, organizationId: string, mediaId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/medias/${mediaId}`,
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
  async updateMedia(
    baseUrl: string,
    organizationId: string,
    mediaId: string,
    playlist: Partial<MediasUpdate>
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/medias/${mediaId}`,
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
};
