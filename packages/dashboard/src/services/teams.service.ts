import { baseUrl } from '../env';
import { fetchOptionsToQueryString, handleResponse } from './util';
import { JsonTeam, Team } from '../interfaces/team';
import { FetchDataOptions, ItemBase, SortOptions } from '@castmill/ui-common';

export type TeamUpdate = Partial<Team> & { id: number };

// This is code repetition that comes from devices.service.ts and must be refactored.
// This code is used for the tables when adding a resource to a team, we are not there yet.
export interface TeamResource extends ItemBase<string | number> {
  id: number | string;
  name: string;
  icon: string;
}

export interface FetchOptions {
  page: { num: number; size: number };
  sortOptions: SortOptions;
  search?: string;
  filters?: Record<string, string | boolean>;
}

export const TeamsService = {
  /**
   * Adds a team.
   *
   * @returns JsonTeam
   */
  async addTeam(organizationId: string, name: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team: { name } }),
      }
    );

    const result = await handleResponse<{ data: JsonTeam }>(response, {
      parse: true,
    });
    return result.data;
  },

  /**
   * Updates a team.
   *
   * @returns JsonTeam
   */
  async updateTeam(organizationId: string, team: TeamUpdate) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${team.id}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(team),
      }
    );

    if (response.status >= 400) {
      let errMessage;
      try {
        const error = JSON.stringify(
          (await response.json()) || response.statusText
        );
        errMessage = error;
      } catch (error) {
        throw new Error(`Failed to update team ${team.name} ${error}`);
      }

      throw new Error(errMessage);
    }
  },

  /**
   * Invite user to team
   */
  async inviteUser(organizationId: string, teamId: number, email: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/invitations`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      }
    );

    const { data } = await handleResponse<{ data: { id: number } }>(response, {
      parse: true,
    });
    return data;
  },

  /**
   * Remove Invitation from team
   *
   */
  async removeInvitationFromTeam(
    organizationId: string,
    teamId: number,
    invitationId: number
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/invitations/${invitationId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to remove invitation from team');
    }
  },

  /**
   * Remove member from team
   * @param organizationId
   * @param teamId
   * @param memberId
   * @returns
   */
  async removeMemberFromTeam(
    organizationId: string,
    teamId: number,
    memberId: string
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/members/${memberId}`,
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
   * Remove Resource from team
   * @param organizationId
   * @param teamId
   * @param resourceType
   * @param resourceId
   */
  async removeResourceFromTeam(
    organizationId: string,
    teamId: number,
    resourceType: string,
    resourceId: string | number
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/${resourceType}/${resourceId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );
  },

  /**
   * Accept team invitation
   *
   * @param organizationId
   *
   * @param options
   * @returns
   */
  async acceptTeamInvitation(organizationId: string, teamId: number) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/accept`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to accept team invitation');
    }
  },

  /**
   * Remove team invitation
   * @param organizationId
   * @param options
   * @returns
   */
  async removeTeamInvitation(organizationId: string, teamId: number) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/invitations`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (response.status !== 200) {
      throw new Error('Failed to remove team invitation');
    }
  },
  /**
   * Fetch Invitations
   *
   * @param organizationId
   * @param teamId
   * @param opts
   * @returns
   */
  async fetchInvitations(
    organizationId: string,
    teamId: number,
    opts: FetchDataOptions
  ) {
    const queryString = fetchOptionsToQueryString(opts);

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/invitations?${queryString}`,
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

  async fetchTeams(organizationId: string, opts: FetchDataOptions) {
    const queryString = fetchOptionsToQueryString(opts);
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch teams');
    }
  },

  async getTeam(organizationId: string, teamId: number) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { data } = await handleResponse<{ data: JsonTeam }>(response, {
      parse: true,
    });
    return data;
  },

  async removeTeam(organizationId: string, teamId: number) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (response.status >= 400) {
      throw new Error('Failed to remove team');
    }
  },

  async fetchMembers(
    organizationId: string,
    teamId: number,
    opts: FetchDataOptions
  ) {
    const queryString = fetchOptionsToQueryString(opts);

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/members?${queryString}`,
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

  async fetchResourcesLegacy(
    organizationId: string,
    teamId: number,
    options: any
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/resources`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (response.status === 200) {
      return await response.json();
    } else {
      throw new Error('Failed to fetch resources');
    }
  },

  async getInvitation(email: string, token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/invitations/${token}?email=${email}`,
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

  async acceptInvitation(email: string, token: string) {
    const response = await fetch(
      `${baseUrl}/dashboard/invitations/${token}/accept?email=${email}`,
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

  async fetchResources(
    organizationId: string,
    teamId: number,
    resourceType: string,
    { page, sortOptions, search, filters }: FetchOptions
  ) {
    const filtersToString = (filters: Record<string, string | boolean>) => {
      return Object.entries(filters)
        .map(([key, value]) =>
          typeof value === 'boolean' ? `${key}` : `${key}:${value}`
        )
        .join(',');
    };

    const query: {
      [key: string]: string;
    } = {
      ...sortOptions,
      page_size: page.size.toString(),
      page: page.num.toString(),
    };

    if (search) {
      query['search'] = search;
    }

    if (filters) {
      query['filters'] = filtersToString(filters);
    }

    const queryString = new URLSearchParams(query).toString();

    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/${resourceType}?${queryString}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return handleResponse<{ data: TeamResource[]; count: number }>(response, {
      parse: true,
    });
  },

  async addResource(
    organizationId: string,
    teamId: number,
    resourceType: string,
    resourceId: string,
    access: string[]
  ) {
    const response = await fetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/teams/${teamId}/${resourceType}/${resourceId}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access }),
      }
    );

    if (response.status >= 400) {
      throw new Error('Failed to add resource');
    }
  },
};
