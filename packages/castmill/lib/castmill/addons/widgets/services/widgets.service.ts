import { JsonWidget } from '@castmill/player';
import { SortOptions } from '@castmill/ui-common';

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
    throw new Error(errMsg);
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
    options: FetchWidgetsOptions
  ): Promise<{ data: JsonWidget[]; count: number }> {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/widgets`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // For now, the API returns a simple array. We'll wrap it in the expected format
    // and handle client-side pagination, sorting, and filtering
    const widgets = await handleResponse<JsonWidget[]>(response, {
      parse: true,
    });

    let filteredWidgets = widgets;

    // Client-side search
    if (options.search && options.search.trim()) {
      const searchTerm = options.search.toLowerCase();
      filteredWidgets = filteredWidgets.filter(
        (widget) =>
          widget.name.toLowerCase().includes(searchTerm) ||
          (widget.description && widget.description.toLowerCase().includes(searchTerm))
      );
    }

    // Client-side sorting
    if (options.sortOptions.field) {
      const { field, direction } = options.sortOptions;
      filteredWidgets.sort((a, b) => {
        const aVal = (a as any)[field] || '';
        const bVal = (b as any)[field] || '';
        const comparison = aVal.toString().localeCompare(bVal.toString());
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    // Client-side pagination
    const totalCount = filteredWidgets.length;
    const startIndex = (options.page - 1) * options.page_size;
    const endIndex = startIndex + options.page_size;
    const paginatedWidgets = filteredWidgets.slice(startIndex, endIndex);

    return {
      data: paginatedWidgets,
      count: totalCount,
    };
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
};