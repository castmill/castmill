/**
 * Custom hook for managing team filtering in dashboard pages
 * 
 * This hook provides team fetching and filtering logic for dashboard pages.
 */

import { createEffect, createSignal } from 'solid-js';

export interface Team {
  id: number;
  name: string;
}

interface UseTeamFilterProps {
  baseUrl: string;
  organizationId: string;
}

interface UseTeamFilterReturn {
  teams: () => Team[];
  selectedTeamId: () => number | null;
  setSelectedTeamId: (teamId: number | null) => void;
}

export const useTeamFilter = (props: UseTeamFilterProps): UseTeamFilterReturn => {
  const [teams, setTeams] = createSignal<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = createSignal<number | null>(null);

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

  return {
    teams,
    selectedTeamId,
    setSelectedTeamId,
  };
};
