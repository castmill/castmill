import { describe, it, expect } from 'vitest';
import { fetchOptionsToQueryString } from './fetch-options-to-query-string';
import { FetchDataOptions } from '../components';

describe('fetchOptionsToQueryString', () => {
  describe('basic functionality', () => {
    it('should include default page size and page number', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('page_size')).toBe('10');
      expect(params.get('page')).toBe('1');
    });

    it('should include custom page size and page number', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        page: { size: 25, num: 3 },
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('page_size')).toBe('25');
      expect(params.get('page')).toBe('3');
    });

    it('should include sort options', () => {
      const options: FetchDataOptions = {
        sortOptions: { sort: 'name', order: 'asc' },
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('sort')).toBe('name');
      expect(params.get('order')).toBe('asc');
    });

    it('should include search parameter when provided', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        search: 'test search',
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('search')).toBe('test search');
    });

    it('should omit search parameter when not provided', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('search')).toBe(false);
    });
  });

  describe('filters', () => {
    it('should serialize string filters', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        filters: { status: 'active', type: 'video' },
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('filters')).toBe('status:active,type:video');
    });

    it('should serialize boolean filters', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        filters: { is_archived: true, is_published: false },
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      const filters = params.get('filters');
      expect(filters).toContain('is_archived');
      expect(filters).toContain('is_published');
    });

    it('should omit filters when not provided', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('filters')).toBe(false);
    });
  });

  describe('team_id', () => {
    it('should include team_id when provided', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        team_id: 42,
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('team_id')).toBe('42');
    });

    it('should omit team_id when undefined', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        team_id: undefined,
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('team_id')).toBe(false);
    });

    it('should omit team_id when null', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        team_id: null,
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('team_id')).toBe(false);
    });

    it('should include team_id when zero', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        team_id: 0,
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('team_id')).toBe('0');
    });
  });

  describe('tag_ids', () => {
    it('should serialize non-empty tag_ids array', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_ids: [1, 2, 3],
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('tag_ids')).toBe('1,2,3');
    });

    it('should serialize single tag_id', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_ids: [42],
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('tag_ids')).toBe('42');
    });

    it('should omit tag_ids when empty array', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_ids: [],
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('tag_ids')).toBe(false);
    });

    it('should omit tag_ids when undefined', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('tag_ids')).toBe(false);
    });
  });

  describe('tag_filter_mode', () => {
    it('should include tag_filter_mode when set to "any"', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_filter_mode: 'any',
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('tag_filter_mode')).toBe('any');
    });

    it('should include tag_filter_mode when set to "all"', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_filter_mode: 'all',
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('tag_filter_mode')).toBe('all');
    });

    it('should omit tag_filter_mode when undefined', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('tag_filter_mode')).toBe(false);
    });

    it('should omit tag_filter_mode when empty string', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_filter_mode: '',
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.has('tag_filter_mode')).toBe(false);
    });
  });

  describe('combined parameters', () => {
    it('should handle tag_ids and tag_filter_mode together', () => {
      const options: FetchDataOptions = {
        sortOptions: {},
        tag_ids: [10, 20, 30],
        tag_filter_mode: 'all',
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('tag_ids')).toBe('10,20,30');
      expect(params.get('tag_filter_mode')).toBe('all');
    });

    it('should handle all parameters together', () => {
      const options: FetchDataOptions = {
        sortOptions: { sort: 'created_at', order: 'desc' },
        page: { size: 50, num: 2 },
        search: 'digital signage',
        filters: { status: 'active' },
        team_id: 5,
        tag_ids: [1, 2],
        tag_filter_mode: 'any',
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('sort')).toBe('created_at');
      expect(params.get('order')).toBe('desc');
      expect(params.get('page_size')).toBe('50');
      expect(params.get('page')).toBe('2');
      expect(params.get('search')).toBe('digital signage');
      expect(params.get('filters')).toBe('status:active');
      expect(params.get('team_id')).toBe('5');
      expect(params.get('tag_ids')).toBe('1,2');
      expect(params.get('tag_filter_mode')).toBe('any');
    });

    it('should only include provided parameters', () => {
      const options: FetchDataOptions = {
        sortOptions: { sort: 'name' },
        tag_ids: [1],
      };
      const queryString = fetchOptionsToQueryString(options);
      const params = new URLSearchParams(queryString);

      expect(params.get('sort')).toBe('name');
      expect(params.get('tag_ids')).toBe('1');
      expect(params.has('search')).toBe(false);
      expect(params.has('filters')).toBe(false);
      expect(params.has('team_id')).toBe(false);
      expect(params.has('tag_filter_mode')).toBe(false);
    });
  });
});
