import { User } from '../interfaces/user.interface';
import { baseUrl } from '../env';
import { HttpError } from '@castmill/ui-common';
import { handleResponse } from './util';

export class SoleAdministratorError extends Error {
  constructor(
    public organizationName?: string,
    message?: string
  ) {
    super(message || 'Cannot delete account - sole administrator');
    this.name = 'SoleAdministratorError';
  }
}

export const UserService = {
  /**
   * Update current user's profile information
   */
  async updateProfile(userId: string, updates: Partial<User>) {
    const response = await fetch(`${baseUrl}/dashboard/users/${userId}`, {
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
    const response = await fetch(`${baseUrl}/dashboard/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.status !== 204) {
      // Try to extract error information from response
      try {
        const errorData = await response.json();

        // Check for structured error response
        if (errorData.error === 'sole_administrator') {
          throw new SoleAdministratorError(
            errorData.organization_name,
            `Cannot delete account. You are the sole administrator of '${errorData.organization_name}' which has other members.`
          );
        }

        // Handle other error types
        if (errorData.error) {
          throw new HttpError(errorData.error, response.status);
        }

        // Legacy: handle old message format
        if (errorData.message) {
          throw new Error(errorData.message);
        }
      } catch (error) {
        // If it's already our custom error, re-throw it
        if (
          error instanceof SoleAdministratorError ||
          error instanceof HttpError
        ) {
          throw error;
        }
        // Otherwise, generic parsing error
      }

      // Fallback error
      throw new HttpError('Failed to delete account', response.status);
    }
  },

  /**
   * Get current user information
   */
  async getCurrentUser(userId: string) {
    const response = await fetch(`${baseUrl}/dashboard/users/${userId}`, {
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

  /**
   * Get all user credentials/passkeys
   */
  async getUserCredentials(userId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/credentials`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse<{
      credentials: Array<{
        id: string;
        name: string;
        inserted_at: string;
        updated_at: string;
      }>;
    }>(response, { parse: true });
  },

  /**
   * Delete a user credential/passkey
   */
  async deleteCredential(userId: string, credentialId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/credentials/${credentialId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (response.status !== 204) {
      throw new Error('Failed to delete credential');
    }
  },

  /**
   * Update credential name
   */
  async updateCredentialName(
    userId: string,
    credentialId: string,
    name: string
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/credentials/${credentialId}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    );

    return handleResponse<{ status: string; message: string }>(response, {
      parse: true,
    });
  },

  /**
   * Send email verification for new email
   */
  async sendEmailVerification(userId: string, newEmail: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/send-email-verification`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail }),
      }
    );

    return handleResponse<{ status: string; message: string }>(response, {
      parse: true,
    });
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, newEmail: string) {
    const response = await fetch(`${baseUrl}/dashboard/verify-email`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, email: newEmail }),
    });

    return handleResponse<{ status: string; user: User }>(response, {
      parse: true,
    });
  },

  /**
   * Create a challenge for adding a new credential/passkey
   */
  async createCredentialChallenge(userId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/credentials/challenge`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    return handleResponse<{ challenge: string; user_id: string }>(response, {
      parse: true,
    });
  },

  /**
   * Add a new credential/passkey
   */
  async addCredential(
    userId: string,
    credentialId: string,
    publicKeySpki: string,
    clientDataJSON: Uint8Array
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/credentials`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_id: credentialId,
          public_key_spki: publicKeySpki,
          client_data_json: Array.from(clientDataJSON),
        }),
      }
    );

    return handleResponse<{
      status: string;
      message: string;
      credential: { id: string; name: string; inserted_at: string };
    }>(response, { parse: true });
  },
};
