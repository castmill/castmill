/**
 * Tags Service
 *
 * Service for managing tags and tag groups - flexible labels for organizing resources.
 */

export interface Tag {
  id: number;
  name: string;
  color: string;
  position: number;
  tag_group_id?: number | null;
  organization_id: string;
  inserted_at: string;
  updated_at: string;
}

export interface TagGroup {
  id: number;
  name: string;
  color?: string;
  icon?: string;
  position: number;
  organization_id: string;
  tags?: Tag[];
  inserted_at: string;
  updated_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  position?: number;
  tag_group_id?: number | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  position?: number;
  tag_group_id?: number | null;
}

export interface CreateTagGroupInput {
  name: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface UpdateTagGroupInput {
  name?: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface TagUsageStats {
  tag: Tag;
  count: number;
}

export type ResourceType = 'media' | 'device' | 'playlist' | 'channel';

// Default color palette for tags
export const TAG_COLOR_PALETTE = [
  '#3B82F6', // Blue (default)
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6B7280', // Gray
] as const;

export const DEFAULT_TAG_COLOR = TAG_COLOR_PALETTE[0];

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  return response.json();
}

export class TagsService {
  constructor(private baseUrl: string) {}

  private getUrl(organizationId: string, path: string = ''): string {
    return `${this.baseUrl}/dashboard/organizations/${organizationId}${path}`;
  }

  // ============================================================================
  // Tag Groups
  // ============================================================================

  /**
   * List all tag groups for an organization.
   */
  async listTagGroups(
    organizationId: string,
    opts?: { preloadTags?: boolean }
  ): Promise<TagGroup[]> {
    const params = new URLSearchParams();
    if (opts?.preloadTags) {
      params.set('preload_tags', 'true');
    }

    const url = `${this.getUrl(organizationId, '/tag-groups')}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: TagGroup[] }>(response);
    return result.data;
  }

  /**
   * Get a single tag group by ID.
   */
  async getTagGroup(
    organizationId: string,
    tagGroupId: number
  ): Promise<TagGroup> {
    const url = this.getUrl(organizationId, `/tag-groups/${tagGroupId}`);
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: TagGroup }>(response);
    return result.data;
  }

  /**
   * Create a new tag group.
   */
  async createTagGroup(
    organizationId: string,
    input: CreateTagGroupInput
  ): Promise<TagGroup> {
    const url = this.getUrl(organizationId, '/tag-groups');
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await handleResponse<{ data: TagGroup }>(response);
    return result.data;
  }

  /**
   * Update a tag group.
   */
  async updateTagGroup(
    organizationId: string,
    tagGroupId: number,
    input: UpdateTagGroupInput
  ): Promise<TagGroup> {
    const url = this.getUrl(organizationId, `/tag-groups/${tagGroupId}`);
    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await handleResponse<{ data: TagGroup }>(response);
    return result.data;
  }

  /**
   * Delete a tag group.
   */
  async deleteTagGroup(
    organizationId: string,
    tagGroupId: number
  ): Promise<void> {
    const url = this.getUrl(organizationId, `/tag-groups/${tagGroupId}`);
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    await handleResponse<{ success: boolean }>(response);
  }

  // ============================================================================
  // Tags
  // ============================================================================

  /**
   * List all tags for an organization.
   */
  async listTags(
    organizationId: string,
    opts?: { tagGroupId?: number; preloadTagGroup?: boolean }
  ): Promise<Tag[]> {
    const params = new URLSearchParams();
    if (opts?.tagGroupId) {
      params.set('tag_group_id', String(opts.tagGroupId));
    }
    if (opts?.preloadTagGroup) {
      params.set('preload_tag_group', 'true');
    }

    const url = `${this.getUrl(organizationId, '/tags')}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: Tag[] }>(response);
    return result.data;
  }

  /**
   * Get a single tag by ID.
   */
  async getTag(organizationId: string, tagId: number): Promise<Tag> {
    const url = this.getUrl(organizationId, `/tags/${tagId}`);
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: Tag }>(response);
    return result.data;
  }

  /**
   * Create a new tag.
   */
  async createTag(organizationId: string, input: CreateTagInput): Promise<Tag> {
    const url = this.getUrl(organizationId, '/tags');
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await handleResponse<{ data: Tag }>(response);
    return result.data;
  }

  /**
   * Update a tag.
   */
  async updateTag(
    organizationId: string,
    tagId: number,
    input: UpdateTagInput
  ): Promise<Tag> {
    const url = this.getUrl(organizationId, `/tags/${tagId}`);
    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result = await handleResponse<{ data: Tag }>(response);
    return result.data;
  }

  /**
   * Delete a tag.
   */
  async deleteTag(organizationId: string, tagId: number): Promise<void> {
    const url = this.getUrl(organizationId, `/tags/${tagId}`);
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    await handleResponse<{ success: boolean }>(response);
  }

  /**
   * Get the color palette for tags.
   */
  async getColorPalette(organizationId: string): Promise<string[]> {
    const url = this.getUrl(organizationId, '/tags/colors');
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: string[] }>(response);
    return result.data;
  }

  /**
   * Get tag usage statistics.
   */
  async getTagStats(organizationId: string): Promise<TagUsageStats[]> {
    const url = this.getUrl(organizationId, '/tags/stats');
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: TagUsageStats[] }>(response);
    return result.data;
  }

  // ============================================================================
  // Resource Tags
  // ============================================================================

  /**
   * Get tags for a specific resource.
   */
  async getResourceTags(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: number | string
  ): Promise<Tag[]> {
    const url = this.getUrl(
      organizationId,
      `/${resourceType}s/${resourceId}/tags`
    );
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await handleResponse<{ data: Tag[] }>(response);
    return result.data;
  }

  /**
   * Add a tag to a resource.
   */
  async tagResource(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: number | string,
    tagId: number
  ): Promise<void> {
    const url = this.getUrl(
      organizationId,
      `/${resourceType}s/${resourceId}/tags`
    );
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });

    await handleResponse<{ data: any }>(response);
  }

  /**
   * Remove a tag from a resource.
   */
  async untagResource(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: number | string,
    tagId: number
  ): Promise<void> {
    const url = this.getUrl(
      organizationId,
      `/${resourceType}s/${resourceId}/tags/${tagId}`
    );
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    await handleResponse<{ success: boolean }>(response);
  }

  /**
   * Set all tags for a resource (replaces existing tags).
   */
  async setResourceTags(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: number | string,
    tagIds: number[]
  ): Promise<void> {
    const url = this.getUrl(
      organizationId,
      `/${resourceType}s/${resourceId}/tags`
    );
    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_ids: tagIds }),
    });

    await handleResponse<{ data: any[] }>(response);
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Add a tag to multiple resources at once.
   */
  async bulkTagResources(
    organizationId: string,
    tagId: number,
    resourceType: ResourceType,
    resourceIds: (number | string)[]
  ): Promise<number> {
    const url = this.getUrl(organizationId, `/tags/${tagId}/bulk`);
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_type: resourceType,
        resource_ids: resourceIds,
      }),
    });

    const result = await handleResponse<{ success: boolean; count: number }>(
      response
    );
    return result.count;
  }

  /**
   * Remove a tag from multiple resources at once.
   */
  async bulkUntagResources(
    organizationId: string,
    tagId: number,
    resourceType: ResourceType,
    resourceIds: (number | string)[]
  ): Promise<number> {
    const url = this.getUrl(organizationId, `/tags/${tagId}/bulk`);
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_type: resourceType,
        resource_ids: resourceIds,
      }),
    });

    const result = await handleResponse<{ success: boolean; count: number }>(
      response
    );
    return result.count;
  }
}
