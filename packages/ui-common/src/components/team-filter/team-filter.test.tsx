import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@solidjs/testing-library';
import { TeamFilter, TEAM_FILTER_SEARCH_THRESHOLD } from './team-filter';

const teams = [
  { id: 1, name: 'Lund' },
  { id: 2, name: 'Malmö' },
];

describe('TeamFilter', () => {
  afterEach(() => cleanup());

  it('renders nothing when there are no teams', () => {
    const { container } = render(() => (
      <TeamFilter teams={[]} onTeamChange={() => {}} />
    ));
    expect(container.querySelector('.castmill-team-filter')).toBeNull();
  });

  it('selects a single team and closes the panel', async () => {
    const onTeamChange = vi.fn();
    render(() => (
      <TeamFilter
        teams={teams}
        selectedTeamId={1}
        onTeamChange={onTeamChange}
        placeholder="Select team"
      />
    ));

    await fireEvent.click(screen.getByRole('button', { name: /Lund/ }));
    expect(screen.getByRole('listbox')).toHaveAttribute(
      'aria-multiselectable',
      'false'
    );

    await fireEvent.click(screen.getByRole('option', { name: 'Malmö' }));
    expect(onTeamChange).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the selected team when it is picked again', async () => {
    const onTeamChange = vi.fn();
    render(() => (
      <TeamFilter
        teams={teams}
        selectedTeamId={1}
        onTeamChange={onTeamChange}
      />
    ));

    await fireEvent.click(screen.getByRole('button', { name: /Lund/ }));
    await fireEvent.click(screen.getByRole('option', { name: /Lund/ }));

    expect(onTeamChange).toHaveBeenCalledWith(1);
  });

  it.each(['Enter', ' '])(
    'returns focus to the trigger after selecting a team with %s',
    async (key) => {
      const onTeamChange = vi.fn();
      const { container } = render(() => (
        <TeamFilter
          teams={teams}
          selectedTeamId={1}
          onTeamChange={onTeamChange}
        />
      ));

      const trigger = screen.getByRole('button', { name: /Lund/ });
      await fireEvent.click(trigger);
      const option = screen.getByRole('option', { name: 'Malmö' });
      option.focus();
      await fireEvent.keyDown(option, { key });

      expect(onTeamChange).toHaveBeenCalledWith(2);
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(document.activeElement).toBe(
        container.querySelector('.msf-trigger')
      );
    }
  );

  it('clears the selection', async () => {
    const onTeamChange = vi.fn();
    render(() => (
      <TeamFilter
        teams={teams}
        selectedTeamId={2}
        onTeamChange={onTeamChange}
        clearLabel="Clear team filter"
      />
    ));

    await fireEvent.click(screen.getByLabelText('Clear team filter'));
    expect(onTeamChange).toHaveBeenCalledWith(null);
  });

  it('only shows search for longer team lists', async () => {
    const many = Array.from(
      { length: TEAM_FILTER_SEARCH_THRESHOLD + 1 },
      (_, i) => ({ id: i + 1, name: `Team ${i + 1}` })
    );

    render(() => (
      <TeamFilter
        teams={teams}
        onTeamChange={() => {}}
        searchPlaceholder="Search teams"
      />
    ));
    await fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByPlaceholderText('Search teams')).toBeNull();
    cleanup();

    render(() => (
      <TeamFilter
        teams={many}
        onTeamChange={() => {}}
        searchPlaceholder="Search teams"
      />
    ));
    await fireEvent.click(screen.getByRole('button'));
    await fireEvent.input(screen.getByPlaceholderText('Search teams'), {
      target: { value: 'Team 8' },
    });
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
