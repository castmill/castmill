/**
 * Permissions Service
 *
 * Fetches and manages user permissions for the current organization.
 * Permissions are used to disable UI actions that users are not allowed to perform.
 */

import { baseUrl } from '../env';

export type Role = 'admin' | 'manager' | 'member' | 'guest';

export type ResourceType =
  | 'playlists'
  | 'medias'
  | 'channels'
  | 'devices'
  | 'teams'
  | 'widgets'
  | 'layouts'
  | 'tags'
  | 'organizations';

export type Action =
  | 'list'
  | 'show'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'manage';

export interface PermissionsResponse {
  role: Role;
  permissions: Record<ResourceType, Action[]>;
  resources: ResourceType[];
}

/**
 * Fetches the permissions for the current user in the specified organization
 */
export async function fetchPermissions(
  organizationId: string
): Promise<PermissionsResponse> {
  const response = await fetch(
    `${baseUrl}/dashboard/organizations/${organizationId}/permissions`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch permissions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Checks if the user has permission to perform an action on a resource type
 */
export function canPerformAction(
  permissions: Record<ResourceType, Action[]> | undefined,
  resource: ResourceType,
  action: Action
): boolean {
  if (!permissions) {
    return false;
  }

  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * Gets all allowed actions for a resource type
 */
export function getAllowedActions(
  permissions: Record<ResourceType, Action[]> | undefined,
  resource: ResourceType
): Action[] {
  if (!permissions) {
    return [];
  }

  return permissions[resource] || [];
}

/**
 * Checks if the user has any of the specified roles
 */
export function hasRole(
  userRole: Role | undefined,
  allowedRoles: Role[]
): boolean {
  if (!userRole) {
    return false;
  }

  return allowedRoles.includes(userRole);
}
