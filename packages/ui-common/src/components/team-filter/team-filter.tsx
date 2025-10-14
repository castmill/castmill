/**
 * TeamFilter Component
 *
 * A dropdown filter for selecting teams. Shows "Organization" option for resources
 * not assigned to any team, and individual team options. Hides the dropdown when no teams exist.
 */

import { Component, Show, createMemo } from 'solid-js';
import { Dropdown } from '../dropdown/dropdown';

import './team-filter.scss';

export interface Team {
  id: number;
  name: string;
}

export interface TeamFilterProps {
  teams: Team[];
  selectedTeamId?: number | null;
  onTeamChange: (teamId: number | null) => void;
  label?: string;
  placeholder?: string;
  clearLabel?: string;
}

export const TeamFilter: Component<TeamFilterProps> = (props) => {
  const items = createMemo(() =>
    props.teams.map((team) => ({
      value: team.id.toString(),
      name: team.name,
    }))
  );

  const currentValue = createMemo(() => {
    const id = props.selectedTeamId;
    return id === null || id === undefined ? null : id.toString();
  });

  const handleChange = (value: string | null) => {
    if (value === null) {
      props.onTeamChange(null);
      return;
    }

    props.onTeamChange(parseInt(value, 10));
  };

  // Only show dropdown if there are teams
  return (
    <Show when={props.teams.length > 0}>
      <div class="castmill-team-filter">
        <Dropdown
          label={props.label || 'Team'}
          items={items()}
          onSelectChange={handleChange}
          value={currentValue()}
          placeholder={props.placeholder}
          clearable
          clearLabel={props.clearLabel}
        />
      </div>
    </Show>
  );
};
