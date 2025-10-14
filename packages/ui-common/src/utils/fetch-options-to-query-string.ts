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

  if (options.team_id !== undefined && options.team_id !== null) {
    query['team_id'] = options.team_id.toString();
  }

  return new URLSearchParams(query).toString();
};
