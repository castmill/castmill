import { User } from '../interfaces/user.interface';
import { baseUrl } from '../env';
import { handleResponse } from './util';

export const UserService = {
  /**
   * Update current user's profile information
   */
  async updateProfile(userId: string, updates: Partial<User>) {
    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user: updates }),
    });

    return handleResponse<User>(response, { parse: true });
  },

  /**
   * Delete current user account
   */
  async deleteAccount(userId: string) {
    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.status !== 204) {
      throw new Error('Failed to delete account');
    }
  },

  /**
   * Get current user information
   */
  async getCurrentUser(userId: string) {
    const response = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<User>(response, { parse: true });
  },

  /**
   * Check if user owns any organizations that need ownership transfer
   */
  async checkOrganizationOwnership(userId: string) {
    // This endpoint might need to be implemented on the backend
    // For now, we'll return a placeholder
    return { hasOrganizations: false, organizations: [] };
  },
};