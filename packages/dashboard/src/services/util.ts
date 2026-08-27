import { FetchDataOptions, HttpError } from '@castmill/ui-common';

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
      const errorPayload = await response.json();
      const { errors, error } = errorPayload ?? {};

      if (typeof error === 'string' && error.trim().length > 0) {
        errMsg = error.trim();
      } else if (errors) {
        if (typeof errors === 'string') {
          errMsg = errors.trim();
        } else if (errors.detail) {
          errMsg = `${errors.detail}`;
        } else if (typeof errors === 'object') {
          const firstEntry = Object.entries(errors)[0];
          if (firstEntry) {
            const [field, fieldErrors] = firstEntry;
            if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
              errMsg = `${field}: ${fieldErrors[0]}`;
            } else if (typeof fieldErrors === 'string') {
              errMsg = `${field}: ${fieldErrors}`;
            }
          }
        }
      }

      if (!errMsg) {
        errMsg = `${response.statusText}`;
      }
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    // Throw HttpError with status code for better error handling
    throw new HttpError(errMsg, response.status);
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
