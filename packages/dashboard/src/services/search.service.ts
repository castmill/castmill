import { baseUrl } from '../env';
import { handleResponse } from './util';

export interface SearchResult {
  resource_type: string;
  data: any[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SearchResponse {
  query: string;
  page: number;
  page_size: number;
  results: SearchResult[];
}

export const SearchService = {
  /**
   * Search across all resources in an organization.
   *
   * @param organizationId - The organization ID to search within
   * @param query - The search query string
   * @param page - The page number (default: 1)
   * @param pageSize - The number of results per page (default: 20)
   * @returns {Promise<SearchResponse>} A promise that resolves to search results
   */
  async search(
    organizationId: string,
    query: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<SearchResponse> {
    const queryParams = new URLSearchParams({
      query,
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/search?${queryParams}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse(response);
  },
};
