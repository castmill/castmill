import { Organization } from '../interfaces/organization';

const baseUrl =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/dashboard';

export const OrganizationsService = {
  /**
   * Get all Organizations.
   *
   * @returns {Promise<Organization[]>} A promise that resolves to an array of Organizations.
   */
  async getAll(userId: string) {
    const response = await fetch(`${baseUrl}/users/${userId}/organizations`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 200) {
      return (await response.json())?.data as Organization[];
    } else {
      throw new Error('Failed to fetch organizations');
    }
  },
};
