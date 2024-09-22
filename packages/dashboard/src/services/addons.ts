import { baseUrl } from '../env';

export const AddonsService = {
  /**
   * Get all AddOns.
   *
   * @returns {Promise<AddOn[]>} A promise that resolves to an array of AddOns.
   */
  async getAll() {
    const response = await fetch(`${baseUrl}/dashboard/addons/`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 200) {
      return response.json();
    } else {
      throw new Error('Failed to fetch AddOns');
    }
  },
};
