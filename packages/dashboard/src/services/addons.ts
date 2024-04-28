const baseUrl =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/dashboard';

export const AddonsService = {
  /**
   * Get all AddOns.
   *
   * @returns {Promise<AddOn[]>} A promise that resolves to an array of AddOns.
   */
  async getAll() {
    const response = await fetch(`${baseUrl}/addons/`, {
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
