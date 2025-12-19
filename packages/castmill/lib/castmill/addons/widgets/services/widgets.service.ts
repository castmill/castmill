import { JsonWidget } from '@castmill/player';
import { SortOptions, HttpError } from '@castmill/ui-common';

export interface FetchWidgetsOptions {
  page: number;
  page_size: number;
  sortOptions: SortOptions;
  search?: string;
  filters?: Record<string, string | boolean>;
}

type HandleResponseOptions = {
  parse?: boolean;
};

export interface WidgetsUpdate {
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

export const WidgetsService = {
  /**
   * Fetch widgets from the server.
   *
   * @param baseUrl - The base URL of the server
   * @param organizationId - The organization ID
   * @param options - Fetch options including pagination, sorting, search, and filters
   * @returns Promise resolving to the list of widgets and total count
   */
  async fetchWidgets(
    baseUrl: string,
    organizationId: string,
    { page, page_size, sortOptions, search, filters }: FetchWidgetsOptions
  ): Promise<{ data: JsonWidget[]; count: number }> {
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

    const queryString = new URLSearchParams(query).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/widgets?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: JsonWidget[]; count: number }>(response, {
      parse: true,
    });
  },

  /**
   * Upload a new widget JSON file.
   *
   * @param baseUrl - The base URL of the server
   * @param organizationId - The organization ID
   * @param file - The widget JSON file to upload
   * @returns Promise resolving to the created widget
   */
  async uploadWidget(
    baseUrl: string,
    organizationId: string,
    file: File
  ): Promise<JsonWidget> {
    const formData = new FormData();
    formData.append('widget', file);

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/widgets`,
      {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }
    );

    return handleResponse<JsonWidget>(response, { parse: true });
  },

  /**
   * Remove a widget.
   *
   * @param baseUrl - The base URL of the server
   * @param organizationId - The organization ID
   * @param widgetId - The widget ID to remove
   * @returns Promise resolving when the widget is removed
   */
  async removeWidget(
    baseUrl: string,
    organizationId: string,
    widgetId: string
  ): Promise<void> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/widgets/${widgetId}`,
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

  /**
   * Update a widget.
   *
   * @param baseUrl - The base URL of the server
   * @param organizationId - The organization ID
   * @param widgetId - The widget ID to update
   * @param updates - The updates to apply
   * @returns Promise resolving to the updated widget
   */
  async updateWidget(
    baseUrl: string,
    organizationId: string,
    widgetId: string,
    updates: WidgetsUpdate
  ): Promise<JsonWidget> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/widgets/${widgetId}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    return handleResponse<JsonWidget>(response, { parse: true });
  },

  /**
   * Get a widget by its ID.
   *
   * @param baseUrl - The base URL of the server
   * @param organizationId - The organization ID
   * @param widgetId - The widget ID
   * @returns Promise resolving to the widget or null if not found
   */
  async getWidgetById(
    baseUrl: string,
    organizationId: string,
    widgetId: number
  ): Promise<JsonWidget | null> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/widgets/${widgetId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    const result = await handleResponse<{ data: JsonWidget }>(response, {
      parse: true,
    });
    return result.data;
  },
};
