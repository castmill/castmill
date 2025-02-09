import { FetchDataOptions } from '@castmill/ui-common';

type HandleResponseOptions = {
  parse?: boolean;
};

export async function handleResponse<T = any>(
  response: Response,
  options: { parse: true }
): Promise<T>;
export async function handleResponse<T = any>(
  response: Response,
  options?: { parse?: false }
): Promise<void>;
export async function handleResponse<T = any>(
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
    // We should NOT throw an exception here. We should handle errors in a different way.
    throw new Error(errMsg);
  }
}

export const fetchOptionsToQueryString = (options: FetchDataOptions) => {
  const filtersToString = (filters: Record<string, string | boolean>) => {
    return Object.entries(filters)
      .map(([key, value]) =>
        typeof value === 'boolean' ? `${key}` : `${key}:${value}`
      )
      .join(',');
  };

  const query: {
    [key: string]: string;
  } = {
    ...options.sortOptions,
    page_size: options.page?.size?.toString() ?? '10',
    page: options.page?.num?.toString() ?? '1',
  };

  if (options.search) {
    query['search'] = options.search;
  }

  if (options.filters) {
    query['filters'] = filtersToString(options.filters);
  }

  return new URLSearchParams(query).toString();
};
