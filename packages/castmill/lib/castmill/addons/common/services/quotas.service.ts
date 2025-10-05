export interface ResourceQuota {
  used: number;
  total: number;
}

export interface QuotaUsage {
  medias?: ResourceQuota;
  playlists?: ResourceQuota;
  devices?: ResourceQuota;
  channels?: ResourceQuota;
  teams?: ResourceQuota;
  storage?: ResourceQuota;
  users?: ResourceQuota;
  [key: string]: ResourceQuota | undefined;
}

export type ResourceType = keyof QuotaUsage;

export class QuotasService {
  constructor(private baseUrl: string) {}

  /**
   * Get quota usage for all resources in an organization.
   *
   * @param organizationId - The organization ID
   * @returns {Promise<QuotaUsage>} A promise that resolves to quota usage data
   */
  async getQuotaUsage(organizationId: string): Promise<QuotaUsage> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/organizations/${organizationId}/usage`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return (await response.json()) as QuotaUsage;
    } else {
      throw new Error('Failed to fetch quota usage data');
    }
  }

  /**
   * Check if organization has reached quota for a specific resource type.
   *
   * @param organizationId - The organization ID
   * @param resourceType - The resource type to check
   * @returns {Promise<boolean>} True if quota is reached, false otherwise
   */
  async isQuotaReached(
    organizationId: string,
    resourceType: ResourceType
  ): Promise<boolean> {
    const usage = await this.getQuotaUsage(organizationId);
    const resourceQuota = usage[resourceType];

    if (!resourceQuota) {
      return false;
    }

    return resourceQuota.used >= resourceQuota.total;
  }

  /**
   * Get quota for a specific resource type.
   *
   * @param organizationId - The organization ID
   * @param resourceType - The resource type
   * @returns {Promise<ResourceQuota | null>} The resource quota or null if not found
   */
  async getResourceQuota(
    organizationId: string,
    resourceType: ResourceType
  ): Promise<ResourceQuota | null> {
    const usage = await this.getQuotaUsage(organizationId);
    return usage[resourceType] || null;
  }
}
