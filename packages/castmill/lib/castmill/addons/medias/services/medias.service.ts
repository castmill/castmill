import { JsonMedia } from "@castmill/player";
import { SortOptions } from "@castmill/ui-common";

const baseUrl = "http://localhost:4000/dashboard";

export interface FetchMediasOptions {
  page: number;
  page_size: number;
  sortOptions: SortOptions;
  search?: string;
  filters?: Record<string, string | boolean>;
}
type HandleResponseOptions = {
  parse?: boolean;
};

export interface MediasUpdate {
  name: string;
  description: string;
}

async function handleResponse<T = any>(response: Response, options: { parse: true }): Promise<T>;
async function handleResponse<T = any>(response: Response, options?: { parse?: false }): Promise<void>;
async function handleResponse<T = any>(response: Response, options: HandleResponseOptions = {}): Promise<T | void> {
  if (response.status >= 200 && response.status < 300) {
    if (options.parse) {
      return (await response.json()) as T;
    }
  } else {
    let errMsg = "";
    try {
      const { errors } = await response.json();
      errMsg = `${errors.detail || response.statusText}`;
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    throw new Error(errMsg);
  }
}

export const MediasService = {
  /**
   * Uploads a media file.
   * 
   * @returns JsonPlaylist
   */
  async uploadMedia(organizationId: string, name: string) {
    const response = await fetch(`${baseUrl}/organizations/${organizationId}/playlists`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    return handleResponse<JsonMedia>(response, { parse: true });
  },

  /**
   * Fetch Medias.
   * 
   * @returns { page: number, data: JsonPlaylist[], total: number }
   */
  async fetchMedias(
    organizationId: string,
    { page, page_size, sortOptions, search, filters }: FetchMediasOptions) {

    const filtersToString = (filters: Record<string, string | boolean>) => {
      return Object.entries(filters).map(([key, value]) =>
        typeof value === "boolean" ? `${key}` : `${key}:${value}`).join(",");
    }

    const query = {
      ...sortOptions,
      page_size: page_size.toString(),
      page: page.toString(),
    } as Record<string, string>;

    if (search) {
      query["search"] = search;
    }

    if (filters) {
      query["filters"] = filtersToString(filters);
    }

    const queryString = new URLSearchParams(query).toString();

    const response = await fetch(`${baseUrl}/organizations/${organizationId}/medias?${queryString}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return handleResponse<{ data: JsonMedia[], count: number }>(response, { parse: true });
  },

  async getPlaylist(organizationId: string, playlistId: number) {
    const response = await fetch(`${baseUrl}/organizations/${organizationId}/playlists/${playlistId}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const { data } = await handleResponse<{ data: JsonMedia }>(response, { parse: true });
    return data;
  },

  /**
   * Remove Media
   */
  async removeMedia(organizationId: string, mediaId: string) {
    const response = await fetch(`${baseUrl}/organizations/${organizationId}/medias/${mediaId}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    handleResponse(response);
  },

  /** 
   * Update playlist
   * */
  async updateMedia(organizationId: string, mediaId: string, playlist: Partial<MediasUpdate>) {
    const response = await fetch(`${baseUrl}/organizations/${organizationId}/medias/${mediaId}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ update: playlist }),
    });

    handleResponse(response);
  },
}
