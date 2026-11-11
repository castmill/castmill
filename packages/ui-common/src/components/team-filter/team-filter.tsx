/** @jsxImportSource solid-js */

/**
 * TeamFilter Component
 *
 * A single-select team filter that shares the look of TagFilter (floating
 * panel, optional search). Clearing the selection shows resources from all
 * teams. Hidden when no teams exist.
 */

import { Component, Show, createMemo } from 'solid-js';
import { MultiSelectFilter } from '../multi-select-filter/multi-select-filter';

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
  /** Search input placeholder (search is shown for longer team lists) */
  searchPlaceholder?: string;
  /** Message when search yields no results */
  noMatchMessage?: string;
}

/** Show the search field once the list no longer fits at a glance. */
export const TEAM_FILTER_SEARCH_THRESHOLD = 7;

export const TeamFilter: Component<TeamFilterProps> = (props) => {
  const selectedIds = createMemo(() => {
    const id = props.selectedTeamId;
    return id === null || id === undefined ? [] : [id];
  });

  const handleChange = (ids: (number | string)[]) => {
    const [id] = ids;
    props.onTeamChange(id === undefined ? null : Number(id));
  };

  return (
    <Show when={props.teams.length > 0}>
      <div class="castmill-team-filter">
        <MultiSelectFilter<Team>
          items={props.teams}
          selectedIds={selectedIds()}
          onSelectionChange={handleChange}
          selectionMode="single"
          label={props.label || 'Team'}
          placeholder={props.placeholder || 'Select team'}
          clearLabel={props.clearLabel}
          searchable={props.teams.length > TEAM_FILTER_SEARCH_THRESHOLD}
          searchPlaceholder={props.searchPlaceholder || 'Search teams\u2026'}
          noMatchMessage={props.noMatchMessage}
        />
      </div>
    </Show>
  );
};
