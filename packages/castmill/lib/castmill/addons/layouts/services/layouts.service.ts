import { SortOptions, HttpError } from '@castmill/ui-common';

/**
 * Zone in a layout (percentages 0-100)
 */
export interface JsonLayoutZone {
  id: string;
  name: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zIndex: number;
}

/**
 * Layout resource as returned by the API
 */
export interface JsonLayout {
  id: string;
  name: string;
  description: string | null;
  aspect_ratio: string;
  zones: {
    zones: JsonLayoutZone[];
  };
  inserted_at?: string;
  updated_at?: string;
}

export interface FetchLayoutsOptions {
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

export interface LayoutUpdate {
  name?: string;
  description?: string;
  aspect_ratio?: string;
  zones?: {
    zones: JsonLayoutZone[];
  };
}

export interface LayoutCreate {
  name: string;
  description?: string;
  aspect_ratio: string;
  zones?: {
    zones: JsonLayoutZone[];
  };
  team_id?: number;
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
      errMsg = `${errorData?.detail || response.statusText}`;
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    const httpError = new HttpError(errMsg, response.status);
    (httpError as any).errorData = errorData;
    throw httpError;
  }
}

export const LayoutsService = {
  /**
   * Creates a new layout.
   */
  async createLayout(
    baseUrl: string,
    organizationId: string,
    data: LayoutCreate
  ): Promise<JsonLayout> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/layouts`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ layout: data }),
      }
    );

    const result = await handleResponse<{ data: JsonLayout }>(response, {
      parse: true,
    });
    return result.data;
  },

  /**
   * Fetches layouts for an organization.
   */
  async fetchLayouts(
    baseUrl: string,
    organizationId: string,
    options: FetchLayoutsOptions
  ): Promise<{ data: JsonLayout[]; count: number }> {
    const { page, page_size, sortOptions, search, filters, team_id } = options;

    const filtersToString = (filters: Record<string, string | boolean>) => {
      return Object.entries(filters)
        .map(([key, value]) =>
          typeof value === 'boolean' ? `${key}` : `${key}:${value}`
        )
        .join(',');
    };

    const query: Record<string, string> = {
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

    if (team_id !== undefined && team_id !== null) {
      query['team_id'] = team_id.toString();
    }

    const queryString = new URLSearchParams(query).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/layouts?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: JsonLayout[]; count: number }>(response, {
      parse: true,
    });
  },

  /**
   * Fetches a single layout by ID.
   */
  async getLayout(
    baseUrl: string,
    organizationId: string,
    layoutId: string | number
  ): Promise<JsonLayout> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/layouts/${layoutId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await handleResponse<{ data: JsonLayout }>(response, {
      parse: true,
    });
    return result.data;
  },

  /**
   * Updates a layout.
   */
  async updateLayout(
    baseUrl: string,
    organizationId: string,
    layoutId: string | number,
    data: LayoutUpdate
  ): Promise<JsonLayout> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/layouts/${layoutId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ update: data }),
      }
    );

    // Update endpoint returns layout directly, not wrapped in { data: ... }
    return handleResponse<JsonLayout>(response, {
      parse: true,
    });
  },

  /**
   * Deletes a layout.
   */
  async deleteLayout(
    baseUrl: string,
    organizationId: string,
    layoutId: string | number
  ): Promise<void> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/layouts/${layoutId}`,
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
};
