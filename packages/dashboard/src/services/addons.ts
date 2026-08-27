import { baseUrl } from '../env';

import { authFetch } from '../components/auth';
export const AddonsService = {
  /**
   * Get all AddOns.
   *
   * @returns {Promise<AddOn[]>} A promise that resolves to an array of AddOns.
   */
  async getAll() {
    const response = await authFetch(`${baseUrl}/dashboard/addons/`, {
      method: 'GET',
    });

    if (response.status === 200) {
      return response.json();
    } else {
      throw new Error('Failed to fetch AddOns');
    }
  },
};
