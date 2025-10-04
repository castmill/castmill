import { Organization } from '../interfaces/organization';
import { baseUrl } from '../env';
import { FetchDataOptions } from '@castmill/ui-common';
import { fetchOptionsToQueryString, handleResponse } from './util';

export const OrganizationsService = {
  /**
   * Get all Organizations.
   *
   * @returns {Promise<Organization[]>} A promise that resolves to an array of Organizations.
   */
  async getAll(userId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/users/${userId}/organizations`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return (await response.json())?.data as Organization[];
    } else {
      throw new Error('Failed to fetch organizations');
    }
  },

  /**
   * Get All members of an Organization.
   *
   */
  async fetchMembers(organizationId: string, opts: FetchDataOptions) {
    const queryString = fetchOptionsToQueryString(opts);

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/members?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch members');
    }
  },

  /**
   * Remove a member from an Organization.
   *
   */
  async removeMemberFromOrganization(organizationId: string, memberId: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/members/${memberId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to remove member from team');
    }
  },

  /**
   * Add a member to an Organization.
   *
   */
  async addMemberToOrganization(
    organizationId: string,
    memberId: string,
    role: 'admin' | 'regular' | 'guest'
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/members/${memberId}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to add member to team');
    }
  },

  /**
   * Invite member to an Organization
   */
  async inviteUser(
    organizationId: string,
    email: string,
    role: 'admin' | 'regular' | 'guest'
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/invitations`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
      }
    );

    const { data } = await handleResponse<{ data: { id: number } }>(response, {
      parse: true,
    });
    return data;
  },

  async getInvitation(email: string, token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations_invitations/${token}?email=${email}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch invitation');
    }
  },

  /**
   * Accept an invitation to an Organization.
   *
   * @param email
   *
   * @param token
   * @returns
   */
  async acceptInvitation(email: string, token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations_invitations/${token}/accept?email=${email}`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to accept invitation');
    }
  },

  /**
   *
   * Remove an invitation from an Organization.
   *
   * @param organizationId
   * @param invitationId
   * @returns
   */
  removeInvitationFromOrganization(
    organizationId: string,
    invitationId: number
  ) {
    return fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/invitations/${invitationId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );
  },

  /**
   * Fetch invitations
   *
   */
  async fetchInvitations(organizationId: string, opts: FetchDataOptions) {
    const queryString = fetchOptionsToQueryString(opts);

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/invitations?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch invitations');
    }
  },

  /**
   * Update an Organization.
   *
   */
  async update(organizationId: string, organization: Partial<Organization>) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(organization),
      }
    );

    if (response.status !== 200) {
      // Try to parse error response
      const errorData = await response.json().catch(() => ({}));
      const error: any = new Error('Failed to update organization');
      error.status = response.status;
      error.data = errorData;
      throw error;
    }
  },
};
