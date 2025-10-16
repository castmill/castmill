import { Organization } from '../interfaces/organization';
import { baseUrl } from '../env';
import { FetchDataOptions, HttpError } from '@castmill/ui-common';
import { fetchOptionsToQueryString, handleResponse } from './util';
import { OrganizationRole } from '../types/organization-role.type';

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

    if (!response.ok) {
      let errorMessage = 'Failed to remove member from organization';

      try {
        const errorData = await response.json();
        if (typeof errorData?.error === 'string') {
          errorMessage = errorData.error;
        }
      } catch (error) {
        console.error(
          'Failed to parse remove organization member error response',
          error
        );
      }

      // Map specific error codes to user-friendly messages
      if (errorMessage === 'Failed to remove member from organization') {
        if (response.status === 422) {
          errorMessage = 'cannot_remove_last_organization_admin';
        } else if (response.status === 404) {
          errorMessage = 'member_not_found';
        }
      }

      throw new HttpError(errorMessage, response.status);
    }
  },

  /**
   * Add a member to an Organization.
   *
   */
  async addMemberToOrganization(
    organizationId: string,
    memberId: string,
    role: 'admin' | 'member' | 'guest'
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
    role: OrganizationRole
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

  async getInvitation(token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations_invitations/${token}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch invitation');
    }
  },

  /**
   * Preview invitation without authentication (checks if user exists)
   */
  async previewInvitation(token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations_invitations/${token}/preview`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to preview invitation');
    }
  },

  /**
   * Accept an invitation to an Organization.
   *
   * @param token
   * @returns
   */
  async acceptInvitation(token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations_invitations/${token}/accept`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to accept invitation');
    }
  },

  /**
   * Reject an invitation to an Organization.
   *
   * @param token
   * @returns
   */
  async rejectInvitation(token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations_invitations/${token}/reject`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to reject invitation');
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
  async removeInvitationFromOrganization(
    organizationId: string,
    invitationId: number
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/invitations/${invitationId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to remove invitation from organization');
    }
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

  /**
   * Update a member's role in an Organization.
   *
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: OrganizationRole
  ) {
    const response = await fetch(`${baseUrl}/dashboard/users/${memberId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access: role,
        organization_id: organizationId,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update member role';

      try {
        const errorData = await response.json();
        if (typeof errorData?.error === 'string') {
          errorMessage = errorData.error;
        }
      } catch (error) {
        console.error(
          'Failed to parse update member role error response',
          error
        );
      }

      throw new HttpError(errorMessage, response.status);
    }
  },
};
