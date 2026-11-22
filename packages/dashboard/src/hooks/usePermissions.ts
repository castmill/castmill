/**
 * usePermissions Hook
 *
 * Provides permissions checking functionality throughout the Dashboard.
 * Automatically loads permissions when organization changes.
 */

import { createEffect, createMemo } from 'solid-js';
import { store, setStore } from '../store';
import {
  fetchPermissions,
  canPerformAction as checkPermission,
  getAllowedActions as getActions,
  type ResourceType,
  type Action,
  type Role,
} from '../services/permissions.service';

// Permissions live in the global store, so requests from different hook
// instances must share the same ordering (including across route remounts).
let permissionsRequest = 0;

/**
 * Hook to manage and check permissions
 */
export function usePermissions() {
  /**
   * Load permissions for the current organization
   */
  const loadPermissions = async (organizationId: string) => {
    if (!organizationId) {
      return;
    }

    const request = ++permissionsRequest;
    const isCurrent = () =>
      request === permissionsRequest &&
      store.organizations.selectedId === organizationId;
    setStore('permissions', {
      loaded: false,
      loading: true,
      role: undefined,
      matrix: undefined,
    });

    try {
      const response = await fetchPermissions(organizationId);
      if (!isCurrent()) return;

      setStore('permissions', {
        loaded: true,
        loading: false,
        role: response.role,
        matrix: response.permissions,
      });
    } catch (error) {
      console.error('Failed to load permissions:', error);
      if (!isCurrent()) return;
      setStore('permissions', {
        loaded: false,
        loading: false,
        role: undefined,
        matrix: undefined,
      });
    }
  };

  /**
   * Check if user can perform an action on a resource
   */
  const canPerformAction = (
    resource: ResourceType,
    action: Action
  ): boolean => {
    return checkPermission(store.permissions.matrix, resource, action);
  };

  /**
   * Get all allowed actions for a resource
   */
  const getAllowedActions = (resource: ResourceType): Action[] => {
    return getActions(store.permissions.matrix, resource);
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: Role): boolean => {
    return store.permissions.role === role;
  };

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: Role[]): boolean => {
    return store.permissions.role
      ? roles.includes(store.permissions.role)
      : false;
  };

  /**
   * Get the current user's role
   */
  const getUserRole = (): Role | undefined => {
    return store.permissions.role;
  };

  /**
   * Check if permissions are loaded
   */
  const isLoaded = createMemo(() => store.permissions.loaded);

  /**
   * Check if permissions are loading
   */
  const isLoading = createMemo(() => store.permissions.loading);

  return {
    loadPermissions,
    canPerformAction,
    getAllowedActions,
    hasRole,
    hasAnyRole,
    getUserRole,
    isLoaded,
    isLoading,
  };
}

/**
 * Effect to automatically load permissions when organization changes
 * Use this in the main App component or ProtectedRoute
 */
export function createPermissionsEffect() {
  createEffect(() => {
    const orgId = store.organizations.selectedId;
    if (orgId && store.organizations.loaded) {
      const { loadPermissions } = usePermissions();
      loadPermissions(orgId);
    }
  });
}
