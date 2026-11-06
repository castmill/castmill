import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { I18nProvider } from '../../i18n';
import {
  AutomationsService,
  ChannelAutomation,
} from '../../services/automations.service';
import { setStore } from '../../store/store';
import { ChannelAutomations, MAX_LISTED_FIRINGS } from './channel-automations';
import { clockRule } from '../automations-page/test-fixtures';

let allowed = true;

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return { ...actual, AutomationsService: { channelAutomations: vi.fn() } };
});
vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylist = vi
      .fn()
      .mockResolvedValue({ data: { id: 12, name: 'Spring offer' } });
  },
}));
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));
vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: unknown }) => (
    <a href={props.href}>{props.children as string}</a>
  ),
}));
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canPerformAction: () => allowed }),
}));
vi.mock('../../store/store', async () => {
  const { createStore } = await import('solid-js/store');
  const [store, setStore] = createStore({
    organizations: { selectedId: 'org-1' },
    permissions: { loaded: true },
  });
  return { store, setStore };
});

const at = (iso: string) => ({ rule_id: 'r1', at: iso });

const automations: ChannelAutomation[] = [
  {
    id: 1,
    name: 'Spring campaign',
    enabled: true,
    rules: [clockRule('r1', 8)],
    occurrences: [at('2026-01-07T09:08:00Z'), at('2026-01-07T08:08:00Z')],
  },
  {
    id: 2,
    name: 'Paused',
    enabled: false,
    rules: [],
    occurrences: [at('2026-01-07T07:00:00Z')],
  },
];

let onMarkersChange: ReturnType<typeof vi.fn>;

const renderPanel = (range = { start: 1, end: 2 }) => {
  const [currentRange, setRange] = createSignal(range);
  render(() => (
    <I18nProvider>
      <ChannelAutomations
        organizationId="org-1"
        channelId={3}
        timeZone="UTC"
        range={currentRange()}
        onMarkersChange={onMarkersChange}
      />
    </I18nProvider>
  ));
  return setRange;
};

const lastMarkers = () => onMarkersChange.mock.lastCall![0];

describe('ChannelAutomations', () => {
  beforeEach(() => {
    allowed = true;
    setStore('permissions', 'loaded', true);
    onMarkersChange = vi.fn();
    vi.mocked(AutomationsService.channelAutomations).mockResolvedValue(
      automations
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists assigned automations and their firings for the visible week', async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getAllByTestId('channel-automation')).toHaveLength(2)
    );
    expect(AutomationsService.channelAutomations).toHaveBeenCalledWith(
      'org-1',
      3,
      { from: new Date(1), to: new Date(2) }
    );
    expect(
      screen.getByText('Every hour at :08', { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('No rules yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Manage automations' })
    ).toHaveAttribute('href', '/org/org-1/automations');

    const firings = screen.getAllByTestId('channel-automation-firing');
    expect(firings).toHaveLength(2);
    expect(firings[0].querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-01-07T08:08:00.000Z'
    );
    expect(screen.getByText('(2 this week)')).toBeInTheDocument();

    expect(lastMarkers()).toEqual([
      expect.objectContaining({ time: Date.parse('2026-01-07T08:08:00Z') }),
      expect.objectContaining({ time: Date.parse('2026-01-07T09:08:00Z') }),
    ]);
    expect(lastMarkers()[0].label).toMatch(/^Spring campaign at /);
  });

  it('hides markers and firings with the toggle', async () => {
    renderPanel();
    const toggle = await screen.findByTestId('toggle-automation-markers');
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(lastMarkers()).toEqual([]);
    expect(
      screen.queryByTestId('channel-automation-firing')
    ).not.toBeInTheDocument();
  });

  it('limits the listed firings', async () => {
    vi.mocked(AutomationsService.channelAutomations).mockResolvedValue([
      {
        ...automations[0],
        occurrences: Array.from({ length: 15 }, (_, i) =>
          at(new Date(Date.UTC(2026, 0, 5, i)).toISOString())
        ),
      },
    ]);
    renderPanel();
    await waitFor(() =>
      expect(screen.getAllByTestId('channel-automation-firing')).toHaveLength(
        MAX_LISTED_FIRINGS
      )
    );
    expect(lastMarkers()).toHaveLength(15);
  });

  it('refetches when the visible week changes', async () => {
    const setRange = renderPanel();
    await screen.findAllByTestId('channel-automation');
    setRange({ start: 10, end: 20 });
    await waitFor(() =>
      expect(AutomationsService.channelAutomations).toHaveBeenLastCalledWith(
        'org-1',
        3,
        { from: new Date(10), to: new Date(20) }
      )
    );
  });

  it('shows an empty state', async () => {
    vi.mocked(AutomationsService.channelAutomations).mockResolvedValue([]);
    renderPanel();
    expect(
      await screen.findByText('No automations are assigned to this channel.')
    ).toBeInTheDocument();
  });

  it('shows an error', async () => {
    vi.mocked(AutomationsService.channelAutomations).mockRejectedValue(
      new Error('down')
    );
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the automations of this channel.'
    );
  });

  it('renders nothing without permission', () => {
    allowed = false;
    renderPanel();
    expect(screen.queryByTestId('channel-automations')).not.toBeInTheDocument();
    expect(AutomationsService.channelAutomations).not.toHaveBeenCalled();
  });
});
