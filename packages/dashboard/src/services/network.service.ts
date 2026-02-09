import { baseUrl } from '../env';
import { handleResponse } from './util';

export interface SocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  facebook?: string;
}

export interface NetworkSettings {
  id: string;
  name: string;
  domain: string;
  email: string;
  logo: string;
  copyright: string;
  default_locale: string;
  privacy_policy_url: string | null;
  invitation_only: boolean;
  invitation_only_org_admins: boolean;
  meta?: Record<string, any>;
  default_plan_id?: number;
  inserted_at: string;
  updated_at: string;
}

/**
 * Helper to extract social links from network meta field
 */
export function getSocialLinks(settings: NetworkSettings | null): SocialLinks {
  return settings?.meta?.social_links || {};
}

export interface NetworkStats {
  organizations_count: number;
  users_count: number;
  devices_count: number;
  teams_count: number;
  total_storage_bytes: number;
}

export interface NetworkAdminStatus {
  is_admin: boolean;
  network_id: string | null;
  access?: string;
}

export interface Organization {
  id: string;
  name: string;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface NetworkUser {
  id: string;
  name: string;
  email: string;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  inserted_at: string;
}

export interface NetworkInvitation {
  id: string;
  email: string;
  organization_name: string;
  status: string;
  inserted_at: string;
  expires_at: string;
}

export interface PaginatedOrganizations {
  data: Organization[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

export interface PublicNetworkSettings {
  name: string;
  logo: string;
  invitation_only: boolean;
  copyright: string;
  email: string;
  default_locale: string;
  privacy_policy_url: string | null;
  social_links: SocialLinks;
}

export const NetworkService = {
  /**
   * Get public network settings (available to all users).
   * Used for footer branding and signup behavior.
   */
  async getPublicSettings(): Promise<PublicNetworkSettings> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/public-settings`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    return handleResponse<PublicNetworkSettings>(response, { parse: true });
  },

  /**
   * Check if the current user is a network admin for their network.
   * This is called during auth/session to determine if network admin UI should be shown.
   */
  async checkAdminStatus(): Promise<NetworkAdminStatus> {
    const response = await fetch(`${baseUrl}/dashboard/network/admin-status`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<NetworkAdminStatus>(response, { parse: true });
  },

  /**
   * Get the current network's settings.
   * Only available to network admins.
   */
  async getSettings(): Promise<NetworkSettings> {
    const response = await fetch(`${baseUrl}/dashboard/network/settings`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<NetworkSettings>(response, { parse: true });
  },

  /**
   * Update the current network's settings.
   * Only available to network admins.
   */
  async updateSettings(
    updates: Partial<
      Pick<
        NetworkSettings,
        | 'name'
        | 'email'
        | 'logo'
        | 'copyright'
        | 'invitation_only'
        | 'invitation_only_org_admins'
        | 'meta'
        | 'default_locale'
        | 'privacy_policy_url'
      >
    >
  ): Promise<NetworkSettings> {
    const response = await fetch(`${baseUrl}/dashboard/network/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ network: updates }),
    });

    return handleResponse<NetworkSettings>(response, { parse: true });
  },

  /**
   * Get network statistics (organizations, users, devices, teams count).
   * Only available to network admins.
   */
  async getStats(): Promise<NetworkStats> {
    const response = await fetch(`${baseUrl}/dashboard/network/stats`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<NetworkStats>(response, { parse: true });
  },

  /**
   * List all organizations in the network with pagination and search.
   * Only available to network admins.
   */
  async listOrganizations(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PaginatedOrganizations> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.pageSize) params.append('page_size', String(options.pageSize));
    if (options?.search) params.append('search', options.search);

    const queryString = params.toString();
    const url = `${baseUrl}/dashboard/network/organizations${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<PaginatedOrganizations>(response, { parse: true });
  },

  /**
   * Delete an organization from the network.
   * Only available to network admins.
   */
  async deleteOrganization(
    organizationId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    return handleResponse<{ success: boolean; message: string }>(response, {
      parse: true,
    });
  },

  /**
   * List all users in the network.
   * Only available to network admins.
   */
  async listUsers(): Promise<NetworkUser[]> {
    const response = await fetch(`${baseUrl}/dashboard/network/users`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<NetworkUser[]>(response, { parse: true });
  },

  /**
   * Create a new organization in the network.
   * Only available to network admins.
   */
  async createOrganization(name: string): Promise<{
    id: string;
    name: string;
    inserted_at: string;
    updated_at: string;
  }> {
    const response = await fetch(`${baseUrl}/dashboard/network/organizations`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organization: { name } }),
    });

    return handleResponse<{
      id: string;
      name: string;
      inserted_at: string;
      updated_at: string;
    }>(response, { parse: true });
  },

  /**
   * List all pending network invitations.
   * Only available to network admins.
   */
  async listInvitations(): Promise<NetworkInvitation[]> {
    const response = await fetch(`${baseUrl}/dashboard/network/invitations`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse<NetworkInvitation[]>(response, { parse: true });
  },

  /**
   * Delete a network invitation.
   * Only available to network admins.
   */
  async deleteInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/invitations/${invitationId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    return handleResponse<{ success: boolean; message: string }>(response, {
      parse: true,
    });
  },

  /**
   * Invite a user to an organization in the network.
   * Only available to network admins.
   */
  async inviteUserToOrganization(
    organizationId: string,
    email: string,
    role: 'admin' | 'member'
  ): Promise<{ success: boolean; message: string; token?: string }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}/invitations`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
      }
    );

    return handleResponse<{
      success: boolean;
      message: string;
      token?: string;
    }>(response, { parse: true });
  },

  /**
   * Block a user in the network.
   * Only available to network admins.
   */
  async blockUser(
    userId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
    user: {
      id: string;
      name: string;
      email: string;
      blocked_at: string | null;
      blocked_reason: string | null;
    };
  }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/users/${userId}/block`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    );

    return handleResponse(response, { parse: true });
  },

  /**
   * Unblock a user in the network.
   * Only available to network admins.
   */
  async unblockUser(userId: string): Promise<{
    success: boolean;
    message: string;
    user: {
      id: string;
      name: string;
      email: string;
      blocked_at: string | null;
      blocked_reason: string | null;
    };
  }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/users/${userId}/block`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    return handleResponse(response, { parse: true });
  },

  /**
   * Delete a user from the network.
   * Only available to network admins.
   */
  async deleteUser(
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/users/${userId}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    return handleResponse<{ success: boolean; message: string }>(response, {
      parse: true,
    });
  },

  /**
   * Block an organization in the network.
   * Only available to network admins.
   */
  async blockOrganization(
    organizationId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
    organization: {
      id: string;
      name: string;
      blocked_at: string | null;
      blocked_reason: string | null;
    };
  }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}/block`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    );

    return handleResponse(response, { parse: true });
  },

  /**
   * Unblock an organization in the network.
   * Only available to network admins.
   */
  async unblockOrganization(organizationId: string): Promise<{
    success: boolean;
    message: string;
    organization: {
      id: string;
      name: string;
      blocked_at: string | null;
      blocked_reason: string | null;
    };
  }> {
    const response = await fetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}/block`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    return handleResponse(response, { parse: true });
  },
};
