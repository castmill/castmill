import { baseUrl } from '../env';
import { Usage } from '../interfaces/usage';

export const UsageService = {
  /**
   * Get all the usage data for the organization.
   *
   * @returns {Promise<Usage>} A promise that resolves to an array of Organizations.
   */
  async getUsage(organizationId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/usage`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return (await response.json()) as Usage;
    } else {
      throw new Error('Failed to fetch usage data');
    }
  },
};
