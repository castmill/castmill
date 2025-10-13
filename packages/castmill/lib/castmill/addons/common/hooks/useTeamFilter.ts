/**
 * Custom hook for managing team filtering in resource pages
 * 
 * This hook provides team fetching and filtering logic that can be reused
 * across all resource pages (medias, playlists, devices, channels).
 * 
 * Features:
 * - Team selection persisted in localStorage per organization
 * - Optional URL parameter reading for shareable filtered views
 * - Automatic validation of URL params against loaded teams
 * - Consistent behavior across dashboard and addon components
 * 
 * URL Parameter Support:
 * When params is provided, the hook reads ?team_id=X from the URL on mount
 * and validates it against the loaded teams. If valid, it sets the initial
 * selection. This enables shareable links like /org/123/content/playlists?team_id=5
 * 
 * Note: URL parameter updates (write) should be handled by the parent component
 * if needed, as addons cannot directly access @solidjs/router. This hook only
 * reads from URL (Option A: Read-Only URL Support).
 */

import { createEffect, createSignal, on } from 'solid-js';
import type { SearchParams, SetSearchParams } from '../interfaces/addon-store';

export interface Team {
  id: number;
  name: string;
}

interface UseTeamFilterProps {
  baseUrl: string;
  organizationId: string;
  /** 
   * Optional URL search params tuple from useSearchParams() or props.params
   * Enables reading ?team_id=X from URL for initial team selection
   */
  params?: [SearchParams, SetSearchParams];
}

interface UseTeamFilterReturn {
  teams: () => Team[];
  selectedTeamId: () => number | null;
  setSelectedTeamId: (teamId: number | null) => void;
}

const STORAGE_KEY_PREFIX = 'castmill_selected_team_';

const parseTeamIdParam = (value: string | undefined): number | null => {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return null;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeTeamIdParamValue = (
  value: string | undefined
): string | undefined => {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return undefined;
  }

  return value;
};

/**
 * Get the localStorage key for a specific organization
 */
const getStorageKey = (organizationId: string): string => {
  return `${STORAGE_KEY_PREFIX}${organizationId}`;
};

/**
 * Load the selected team ID from localStorage for an organization
 */
const loadSelectedTeamId = (organizationId: string): number | null => {
  try {
    const key = getStorageKey(organizationId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = parseInt(stored, 10);
      return isNaN(parsed) ? null : parsed;
    }
  } catch (error) {
    console.error('Failed to load selected team from localStorage:', error);
  }
  return null;
};

/**
 * Save the selected team ID to localStorage for an organization
 */
const saveSelectedTeamId = (organizationId: string, teamId: number | null): void => {
  try {
    const key = getStorageKey(organizationId);
    if (teamId === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, teamId.toString());
    }
  } catch (error) {
    console.error('Failed to save selected team to localStorage:', error);
  }
};

export const useTeamFilter = (props: UseTeamFilterProps): UseTeamFilterReturn => {
  const [teams, setTeams] = createSignal<Team[]>([]);

  const getInitialTeamId = (): number | null => {
    // Priority 1: URL parameter
    if (props.params) {
      const [searchParams] = props.params;
      const urlTeamId = searchParams.team_id;
      if (urlTeamId) {
        const parsed = parseInt(urlTeamId, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    // Priority 2: localStorage
    if (props.organizationId) {
      const persistedTeamId = loadSelectedTeamId(props.organizationId);
      if (persistedTeamId !== null) {
        return persistedTeamId;
      }
    }

    return null;
  };

  const initialTeamId = getInitialTeamId();
  const [selectedTeamId, setSelectedTeamId] = createSignal<number | null>(initialTeamId);
  const [hasHydratedFromParams, setHasHydratedFromParams] = createSignal(initialTeamId !== null);

  const syncTeamIdSearchParam = (teamId: number | null, options?: { replace?: boolean }) => {
    if (!props.params) {
      return;
    }

    const [searchParams, setSearchParams] = props.params;
    const desiredValue = teamId !== null ? teamId.toString() : undefined;
    const currentValue = normalizeTeamIdParamValue(searchParams.team_id);

    if (currentValue === desiredValue) {
      return;
    }

    const nextParams: SearchParams = {};

    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'team_id') {
        continue;
      }

      if (value !== undefined) {
        nextParams[key] = value;
      }
    }

    if (desiredValue !== undefined) {
      nextParams.team_id = desiredValue;
    } else {
      nextParams.team_id = undefined;
    }

    setSearchParams(nextParams, { replace: options?.replace ?? true });
  };

  // Sync URL and storage immediately with the initial selection
  if (props.organizationId && initialTeamId !== null) {
    saveSelectedTeamId(props.organizationId, initialTeamId);
  }

  if (props.params && initialTeamId !== null) {
    syncTeamIdSearchParam(initialTeamId, { replace: true });
  }

  createEffect(
    on(
      () => (props.params ? props.params[0].team_id : undefined),
      (teamId) => {
        if (!props.params) {
          return;
        }

        const urlTeamId = parseTeamIdParam(teamId);
        const currentTeamId = selectedTeamId();

        if (urlTeamId !== currentTeamId) {
          setSelectedTeamId(urlTeamId);

          if (props.organizationId) {
            saveSelectedTeamId(props.organizationId, urlTeamId);
          }
        }

        if (
          urlTeamId === null &&
          (teamId === 'null' || teamId === 'undefined')
        ) {
          syncTeamIdSearchParam(null);
        }

        if (!hasHydratedFromParams()) {
          setHasHydratedFromParams(true);
        }
      }
    )
  );

  /**
   * Validate the selected team against the loaded teams to prevent stale/invalid selections.
   * Also keeps localStorage and URL synchronized when data arrives or changes.
   */
  createEffect(() => {
    const loadedTeams = teams();

    if (!props.organizationId || loadedTeams.length === 0) {
      return;
    }

    const currentTeamId = selectedTeamId();

    if (currentTeamId !== null) {
      const exists = loadedTeams.some((team) => team.id === currentTeamId);
      if (!exists) {
        setSelectedTeamId(null);
        saveSelectedTeamId(props.organizationId, null);
        syncTeamIdSearchParam(null);
      } else {
        saveSelectedTeamId(props.organizationId, currentTeamId);
      }
    } else {
      saveSelectedTeamId(props.organizationId, null);
      syncTeamIdSearchParam(null);
    }
  });

  // Fetch teams for the organization
  createEffect(async () => {
    if (props.organizationId) {
      try {
        const response = await fetch(
          `${props.baseUrl}/dashboard/organizations/${props.organizationId}/teams?page=1&page_size=100`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );
        if (response.ok) {
          const result = await response.json();
          setTeams(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      }
    }
  });

  // Keep URL parameter synchronized with current selection at all times
  createEffect(() => {
    if (!props.params) {
      return;
    }

    if (!hasHydratedFromParams()) {
      return;
    }

    const currentTeamId = selectedTeamId();
    syncTeamIdSearchParam(currentTeamId);
  });

  // Create a wrapper for setSelectedTeamId that persists to localStorage
  const setAndPersistTeamId = (teamId: number | null) => {
    setSelectedTeamId(teamId);

    if (props.organizationId) {
      saveSelectedTeamId(props.organizationId, teamId);
    }

    if (props.params) {
      syncTeamIdSearchParam(teamId);
    }
  };

  return {
    teams,
    selectedTeamId,
    setSelectedTeamId: setAndPersistTeamId,
  };
};
