import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TagsService,
  TAG_COLOR_PALETTE,
  DEFAULT_TAG_COLOR,
} from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  const baseUrl = 'http://localhost:4000';
  const orgId = 'org-123';

  beforeEach(() => {
    service = new TagsService(baseUrl);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(data: any, status = 200) {
    const fn = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    });
    global.fetch = fn;
    return fn;
  }

  // ===========================================================================
  // Constants
  // ===========================================================================

  describe('constants', () => {
    it('exports TAG_COLOR_PALETTE as a non-empty array', () => {
      expect(TAG_COLOR_PALETTE.length).toBeGreaterThan(0);
    });

    it('exports DEFAULT_TAG_COLOR as the first palette color', () => {
      expect(DEFAULT_TAG_COLOR).toBe(TAG_COLOR_PALETTE[0]);
    });
  });

  // ===========================================================================
  // Tag Groups
  // ===========================================================================

  describe('listTagGroups', () => {
    it('fetches tag groups for an organization', async () => {
      const groups = [{ id: 1, name: 'Region' }];
      const fetchMock = mockFetch({ data: groups });

      const result = await service.listTagGroups(orgId);

      expect(result).toEqual(groups);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/dashboard/organizations/${orgId}/tag-groups`);
      expect(opts.method).toBe('GET');
      expect(opts.credentials).toBe('include');
    });

    it('passes preloadTags parameter', async () => {
      mockFetch({ data: [] });

      await service.listTagGroups(orgId, { preloadTags: true });

      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('preload_tags=true');
    });
  });

  describe('getTagGroup', () => {
    it('fetches a single tag group', async () => {
      const group = { id: 1, name: 'Region' };
      const fetchMock = mockFetch({ data: group });

      const result = await service.getTagGroup(orgId, 1);

      expect(result).toEqual(group);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain(`/tag-groups/1`);
    });
  });

  describe('createTagGroup', () => {
    it('creates a tag group with correct body', async () => {
      const created = { id: 1, name: 'Campaign', color: '#FF0000' };
      const fetchMock = mockFetch({ data: created });

      const result = await service.createTagGroup(orgId, {
        name: 'Campaign',
        color: '#FF0000',
      });

      expect(result).toEqual(created);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/dashboard/organizations/${orgId}/tag-groups`);
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({
        name: 'Campaign',
        color: '#FF0000',
      });
    });
  });

  describe('updateTagGroup', () => {
    it('sends PUT with update payload', async () => {
      const updated = { id: 1, name: 'New Name' };
      const fetchMock = mockFetch({ data: updated });

      const result = await service.updateTagGroup(orgId, 1, {
        name: 'New Name',
      });

      expect(result).toEqual(updated);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/tag-groups/1`);
      expect(opts.method).toBe('PUT');
    });
  });

  describe('deleteTagGroup', () => {
    it('sends DELETE request', async () => {
      const fetchMock = mockFetch({ success: true });

      await service.deleteTagGroup(orgId, 1);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/tag-groups/1`);
      expect(opts.method).toBe('DELETE');
    });
  });

  // ===========================================================================
  // Tags
  // ===========================================================================

  describe('listTags', () => {
    it('fetches tags for an organization', async () => {
      const tags = [{ id: 1, name: 'London', color: '#3B82F6' }];
      const fetchMock = mockFetch({ data: tags });

      const result = await service.listTags(orgId);

      expect(result).toEqual(tags);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain(`/dashboard/organizations/${orgId}/tags`);
    });

    it('passes tagGroupId filter', async () => {
      mockFetch({ data: [] });

      await service.listTags(orgId, { tagGroupId: 5 });

      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('tag_group_id=5');
    });

    it('passes preloadTagGroup parameter', async () => {
      mockFetch({ data: [] });

      await service.listTags(orgId, { preloadTagGroup: true });

      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('preload_tag_group=true');
    });
  });

  describe('createTag', () => {
    it('creates a tag with correct body', async () => {
      const tag = { id: 1, name: 'Berlin', color: '#10B981' };
      const fetchMock = mockFetch({ data: tag });

      const result = await service.createTag(orgId, {
        name: 'Berlin',
        color: '#10B981',
      });

      expect(result).toEqual(tag);
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({
        name: 'Berlin',
        color: '#10B981',
      });
    });
  });

  describe('updateTag', () => {
    it('sends PUT with update payload', async () => {
      const updated = { id: 1, name: 'Updated' };
      const fetchMock = mockFetch({ data: updated });

      const result = await service.updateTag(orgId, 1, { name: 'Updated' });

      expect(result).toEqual(updated);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/tags/1`);
      expect(opts.method).toBe('PUT');
    });
  });

  describe('deleteTag', () => {
    it('sends DELETE request', async () => {
      const fetchMock = mockFetch({ success: true });

      await service.deleteTag(orgId, 1);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/tags/1`);
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('getTag', () => {
    it('fetches a single tag by ID', async () => {
      const tag = { id: 5, name: 'Berlin', color: '#10B981' };
      const fetchMock = mockFetch({ data: tag });

      const result = await service.getTag(orgId, 5);

      expect(result).toEqual(tag);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain(`/tags/5`);
      expect(opts.method).toBe('GET');
    });
  });

  describe('getColorPalette', () => {
    it('fetches the color palette', async () => {
      const colors = ['#FF0000', '#00FF00'];
      mockFetch({ data: colors });

      const result = await service.getColorPalette(orgId);

      expect(result).toEqual(colors);
    });
  });

  describe('getTagStats', () => {
    it('fetches tag usage statistics', async () => {
      const stats = [{ tag: { id: 1, name: 'Test' }, count: 5 }];
      mockFetch({ data: stats });

      const result = await service.getTagStats(orgId);

      expect(result).toEqual(stats);
    });
  });

  // ===========================================================================
  // Resource Tags
  // ===========================================================================

  describe('getResourceTags', () => {
    it('fetches tags for a media (integer ID)', async () => {
      const tags = [{ id: 1, name: 'Featured' }];
      mockFetch({ data: tags });

      const result = await service.getResourceTags(orgId, 'media', 42);

      expect(result).toEqual(tags);
      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain('/medias/42/tags');
    });

    it('fetches tags for a device (UUID)', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      mockFetch({ data: [] });

      await service.getResourceTags(orgId, 'device', uuid);

      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain(`/devices/${uuid}/tags`);
    });
  });

  describe('tagResource', () => {
    it('tags a media resource', async () => {
      const fetchMock = mockFetch({ data: { tag_id: 1 } });

      await service.tagResource(orgId, 'media', 42, 1);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/medias/42/tags');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ tag_id: 1 });
    });

    it('tags a device resource (UUID)', async () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      mockFetch({ data: { tag_id: 1 } });

      await service.tagResource(orgId, 'device', uuid, 1);

      const [url] = (global.fetch as any).mock.calls[0];
      expect(url).toContain(`/devices/${uuid}/tags`);
    });
  });

  describe('untagResource', () => {
    it('untags a resource', async () => {
      const fetchMock = mockFetch({ success: true });

      await service.untagResource(orgId, 'playlist', 10, 3);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/playlists/10/tags/3');
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('setResourceTags', () => {
    it('replaces all tags on a resource', async () => {
      const fetchMock = mockFetch({ data: [] });

      await service.setResourceTags(orgId, 'channel', 5, [1, 2, 3]);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/channels/5/tags');
      expect(opts.method).toBe('PUT');
      expect(JSON.parse(opts.body)).toEqual({ tag_ids: [1, 2, 3] });
    });
  });

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  describe('bulkTagResources', () => {
    it('bulk tags media resources', async () => {
      const fetchMock = mockFetch({ success: true, count: 3 });

      const count = await service.bulkTagResources(
        orgId,
        1,
        'media',
        [10, 20, 30]
      );

      expect(count).toBe(3);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/tags/1/bulk');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({
        resource_type: 'media',
        resource_ids: [10, 20, 30],
      });
    });

    it('bulk tags device resources with UUIDs', async () => {
      const uuids = ['uuid-1', 'uuid-2'];
      mockFetch({ success: true, count: 2 });

      const count = await service.bulkTagResources(orgId, 1, 'device', uuids);

      expect(count).toBe(2);
    });
  });

  describe('bulkUntagResources', () => {
    it('bulk untags resources', async () => {
      const fetchMock = mockFetch({ success: true, count: 2 });

      const count = await service.bulkUntagResources(
        orgId,
        1,
        'media',
        [10, 20]
      );

      expect(count).toBe(2);
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('DELETE');
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('throws on non-ok response with error message', async () => {
      mockFetch({ error: 'Not found' }, 404);

      await expect(service.listTags(orgId)).rejects.toThrow('Not found');
    });

    it('throws on non-ok response with message field', async () => {
      mockFetch({ message: 'Unauthorized' }, 401);

      await expect(service.listTags(orgId)).rejects.toThrow('Unauthorized');
    });

    it('throws generic message when response has no error details', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('parse error')),
      } as Response);

      await expect(service.listTags(orgId)).rejects.toThrow(
        'Internal Server Error'
      );
    });
  });
});
