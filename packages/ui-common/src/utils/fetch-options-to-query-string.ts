import { FetchDataOptions } from '../components';

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
