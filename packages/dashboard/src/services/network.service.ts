import { baseUrl } from '../env';
import { HttpError } from '@castmill/ui-common';
import { handleResponse } from './util';

import { authFetch } from '../components/auth';
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
  logo_light?: string | null;
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
  role: string;
  organization_id: string;
  organization_name: string;
  status: string;
  inserted_at: string;
  expires_at: string;
}

export type WidgetAccessMode = 'all' | 'except' | 'selected' | 'hidden';
export type WidgetKind = 'system' | 'network';

export interface NetworkWidgetAccess {
  id: number;
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  small_icon: string | null;
  translations?: Record<string, { name?: string; description?: string }>;
  kind: WidgetKind;
  access: WidgetAccessMode;
  /** Excluded (`except`) or included (`selected`) organizations. */
  listed_count: number;
  enabled_count: number;
  eligible_count: number;
  organizations_count: number;
  in_use_count: number;
  core: boolean;
  platform_restricted: boolean;
}

export interface PageInfo {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface NetworkWidgetAccessList {
  data: NetworkWidgetAccess[];
  summary: Record<WidgetAccessMode | 'total', number>;
  organizations_count: number;
  pagination: PageInfo;
}

export interface NetworkWidgetOrganization {
  id: string;
  name: string;
  enabled: boolean;
  in_use: boolean;
}

export interface NetworkWidgetOrganizationList {
  data: NetworkWidgetOrganization[];
  counts: { total: number; enabled: number };
  pagination: PageInfo;
}

export type WidgetOrganizationChanges =
  | { enable?: string[]; disable?: string[] }
  | { all_matching: true; enabled: boolean; search?: string };

/** Details of a 409 response: organizations that still use the widget. */
export interface WidgetInUseDetails {
  organizations: { id: string; name: string }[];
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
};

const handleWidgetAccessResponse = async <T>(
  response: Response
): Promise<T> => {
  if (response.status === 409) {
    const body = await response.json().catch(() => ({}));
    throw new HttpError<WidgetInUseDetails>(
      body.error ?? response.statusText,
      409,
      {
        organizations: body.organizations ?? [],
      }
    );
  }
  return handleResponse<T>(response, { parse: true });
};

export interface PaginatedOrganizations {
  data: Organization[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
  };
}

export interface PaginatedUsers {
  data: NetworkUser[];
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
  logo_light?: string | null;
  invitation_only: boolean;
  copyright: string;
  email: string;
  default_locale: string;
  privacy_policy_url: string | null;
  social_links: SocialLinks;
}

export type IntegrationSettingType = 'string' | 'number' | 'boolean' | 'list';

/** A field of organization-level integration settings, declared by widgets. */
export interface IntegrationSettingField {
  type: IntegrationSettingType;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  order?: number;
}

export type IntegrationSettingValue = string | number | boolean | string[];

/** Settings shared by the network's widgets that declare the same key. */
export interface IntegrationSettings {
  key: string;
  name: string | null;
  description: string | null;
  schema: Record<string, IntegrationSettingField>;
  settings: Record<string, IntegrationSettingValue>;
}

/** Field error codes returned when saving integration settings. */
export type IntegrationSettingError =
  | 'required'
  | 'invalid'
  | 'too_long'
  | 'too_many';

const integrationSettingsUrl = (organizationId: string, key?: string) =>
  `${baseUrl}/dashboard/network/organizations/${organizationId}/integration-settings` +
  (key ? `/${encodeURIComponent(key)}` : '');

export const NetworkService = {
  /**
   * Get public network settings (available to all users).
   * Used for footer branding and signup behavior.
   */
  async getPublicSettings(): Promise<PublicNetworkSettings> {
    const response = await authFetch(
      `${baseUrl}/dashboard/network/public-settings`,
      {
        method: 'GET',
      }
    );

    return handleResponse<PublicNetworkSettings>(response, { parse: true });
  },

  /**
   * Check if the current user is a network admin for their network.
   * This is called during auth/session to determine if network admin UI should be shown.
   */
  async checkAdminStatus(): Promise<NetworkAdminStatus> {
    const response = await authFetch(
      `${baseUrl}/dashboard/network/admin-status`,
      {
        method: 'GET',
      }
    );

    return handleResponse<NetworkAdminStatus>(response, { parse: true });
  },

  /**
   * Get the current network's settings.
   * Only available to network admins.
   */
  async getSettings(): Promise<NetworkSettings> {
    const response = await authFetch(`${baseUrl}/dashboard/network/settings`, {
      method: 'GET',
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
        | 'logo_light'
        | 'copyright'
        | 'invitation_only'
        | 'invitation_only_org_admins'
        | 'meta'
        | 'default_locale'
        | 'privacy_policy_url'
      >
    >
  ): Promise<NetworkSettings> {
    const response = await authFetch(`${baseUrl}/dashboard/network/settings`, {
      method: 'PUT',
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
    const response = await authFetch(`${baseUrl}/dashboard/network/stats`, {
      method: 'GET',
    });

    return handleResponse<NetworkStats>(response, { parse: true });
  },

  /**
   * List the widgets the network admin curates with their access summary.
   * Only available to network admins.
   */
  async listWidgetAccess(options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    kind?: WidgetKind;
    access?: WidgetAccessMode;
  }): Promise<NetworkWidgetAccessList> {
    const query = toQueryString({
      page: options?.page,
      page_size: options?.pageSize,
      search: options?.search,
      kind: options?.kind,
      access: options?.access,
    });
    const response = await authFetch(
      `${baseUrl}/dashboard/network/widgets${query}`,
      { method: 'GET' }
    );

    return handleResponse<NetworkWidgetAccessList>(response, { parse: true });
  },

  /**
   * List the organizations eligible to use a widget and whether each can use it.
   * Only available to network admins.
   */
  async listWidgetOrganizations(
    widgetId: number,
    options?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: 'enabled' | 'disabled';
    }
  ): Promise<NetworkWidgetOrganizationList> {
    const query = toQueryString({
      page: options?.page,
      page_size: options?.pageSize,
      search: options?.search,
      status: options?.status,
    });
    const response = await authFetch(
      `${baseUrl}/dashboard/network/widgets/${widgetId}/organizations${query}`,
      { method: 'GET' }
    );

    return handleResponse<NetworkWidgetOrganizationList>(response, {
      parse: true,
    });
  },

  /**
   * Set who can use a widget: all organizations, all except some, selected ones,
   * or nobody.
   * Rejects with an HttpError (status 409) if organizations still use it.
   */
  async setWidgetAccess(
    widgetId: number,
    access: WidgetAccessMode
  ): Promise<NetworkWidgetAccess> {
    const response = await authFetch(
      `${baseUrl}/dashboard/network/widgets/${widgetId}/access`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access }),
      }
    );

    return handleWidgetAccessResponse<NetworkWidgetAccess>(response);
  },

  /**
   * Enable or disable organizations for a widget, by id or by search.
   * Rejects with an HttpError (status 409) if organizations still use it.
   */
  async updateWidgetOrganizations(
    widgetId: number,
    changes: WidgetOrganizationChanges
  ): Promise<NetworkWidgetAccess> {
    const response = await authFetch(
      `${baseUrl}/dashboard/network/widgets/${widgetId}/organizations`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }
    );

    return handleWidgetAccessResponse<NetworkWidgetAccess>(response);
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

    const response = await authFetch(url, {
      method: 'GET',
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}`,
      {
        method: 'DELETE',
      }
    );

    return handleResponse<{ success: boolean; message: string }>(response, {
      parse: true,
    });
  },

  /**
   * List all users in the network with pagination and search.
   * Only available to network admins.
   */
  async listUsers(opts?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<PaginatedUsers> {
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.pageSize) params.set('page_size', String(opts.pageSize));
    if (opts?.search) params.set('search', opts.search);

    const qs = params.toString();
    const url = `${baseUrl}/dashboard/network/users${qs ? `?${qs}` : ''}`;

    const response = await authFetch(url, {
      method: 'GET',
    });

    return handleResponse<PaginatedUsers>(response, { parse: true });
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/organizations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organization: { name } }),
      }
    );

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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/invitations`,
      {
        method: 'GET',
      }
    );

    return handleResponse<NetworkInvitation[]>(response, { parse: true });
  },

  /**
   * Delete a network invitation.
   * Only available to network admins.
   */
  async deleteInvitation(
    invitationId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await authFetch(
      `${baseUrl}/dashboard/network/invitations/${invitationId}`,
      {
        method: 'DELETE',
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}/invitations`,
      {
        method: 'POST',
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/users/${userId}/block`,
      {
        method: 'POST',
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/users/${userId}/block`,
      {
        method: 'DELETE',
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/users/${userId}`,
      {
        method: 'DELETE',
      }
    );

    return handleResponse<{ success: boolean; message: string }>(response, {
      parse: true,
    });
  },

  /** An organization's integration settings, with the network's definitions. */
  async listIntegrationSettings(
    organizationId: string
  ): Promise<IntegrationSettings[]> {
    const response = await authFetch(integrationSettingsUrl(organizationId), {
      method: 'GET',
    });
    const result = await handleResponse<{ data: IntegrationSettings[] }>(
      response,
      { parse: true }
    );
    return result.data;
  },

  /**
   * Saves an organization's integration settings for one key. Invalid fields
   * reject with an HttpError (status 422) whose data maps fields to codes.
   */
  async updateIntegrationSettings(
    organizationId: string,
    key: string,
    settings: Record<string, IntegrationSettingValue>
  ): Promise<Record<string, IntegrationSettingValue>> {
    const response = await authFetch(
      integrationSettingsUrl(organizationId, key),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      }
    );

    if (response.status === 422) {
      const body = await response.json().catch(() => ({}));
      throw new HttpError<Record<string, IntegrationSettingError>>(
        response.statusText,
        422,
        body.errors ?? {}
      );
    }

    const result = await handleResponse<{
      data: { settings: Record<string, IntegrationSettingValue> };
    }>(response, { parse: true });
    return result.data.settings;
  },

  /** Removes an organization's integration settings for one key. */
  async deleteIntegrationSettings(
    organizationId: string,
    key: string
  ): Promise<void> {
    const response = await authFetch(
      integrationSettingsUrl(organizationId, key),
      { method: 'DELETE' }
    );
    return handleResponse(response);
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}/block`,
      {
        method: 'POST',
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
    const response = await authFetch(
      `${baseUrl}/dashboard/network/organizations/${organizationId}/block`,
      {
        method: 'DELETE',
      }
    );

    return handleResponse(response, { parse: true });
  },
};
