/**
 * TeamFilter Component
 *
 * A dropdown filter for selecting teams. Shows "Organization" option for all resources
 * and individual team options. Hides the dropdown when no teams exist.
 */

import { Component, Show, createEffect, createSignal } from 'solid-js';
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
}

export const TeamFilter: Component<TeamFilterProps> = (props) => {
  const [items, setItems] = createSignal<Array<{ value: string; name: string }>>(
    []
  );

  createEffect(() => {
    const teamItems = props.teams.map((team) => ({
      value: team.id.toString(),
      name: team.name,
    }));

    // Add "Organization" option at the beginning
    setItems([{ value: 'null', name: 'Organization' }, ...teamItems]);
  });

  const handleChange = (value: string) => {
    if (value === 'null') {
      props.onTeamChange(null);
    } else {
      props.onTeamChange(parseInt(value, 10));
    }
  };

  const getDefaultValue = () => {
    if (props.selectedTeamId === null || props.selectedTeamId === undefined) {
      return 'null';
    }
    return props.selectedTeamId.toString();
  };

  // Only show dropdown if there are teams
  return (
    <Show when={props.teams.length > 0}>
      <Dropdown
        label={props.label || 'Team'}
        items={items()}
        onSelectChange={handleChange}
        defaultValue={getDefaultValue()}
      />
    </Show>
  );
};
