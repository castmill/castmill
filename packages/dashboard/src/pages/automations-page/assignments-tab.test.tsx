import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { AutomationsService } from '../../services/automations.service';
import {
  AssignmentsTab,
  AssignmentsTabProps,
  SEARCH_DEBOUNCE_MS,
} from './assignments-tab';
import { automationFixture } from './test-fixtures';

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return { ...actual, AutomationsService: { searchAssignable: vi.fn() } };
});
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

let onSave: ReturnType<typeof vi.fn>;

const renderTab = (props: Partial<AssignmentsTabProps> = {}) =>
  render(() => (
    <I18nProvider>
      <AssignmentsTab
        automation={automationFixture({
          devices: [{ id: 'd1', name: 'Lobby' }],
          channels: [],
        })}
        organizationId="org-1"
        canEdit
        onSave={onSave}
        {...props}
      />
    </I18nProvider>
  ));

const devicesSection = () => screen.getByRole('region', { name: /Devices/ });
const channelsSection = () => screen.getByRole('region', { name: /Channels/ });
const saveButton = () =>
  screen.getByRole('button', { name: 'Save assignments' });

describe('AssignmentsTab', () => {
  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(true);
    vi.mocked(AutomationsService.searchAssignable).mockImplementation(
      async (_org, kind) =>
        kind === 'devices'
          ? {
              count: 2,
              data: [
                { id: 'd1', name: 'Lobby' },
                { id: 'd2', name: 'Cafeteria' },
              ],
            }
          : { count: 1, data: [{ id: 5, name: 'Main channel' }] }
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('selects devices and channels and saves typed ids', async () => {
    renderTab();
    expect(saveButton()).toBeDisabled();
    expect(
      within(channelsSection()).getByText('No channels assigned')
    ).toBeInTheDocument();

    const lobby = await within(devicesSection()).findByLabelText('Lobby');
    expect(lobby).toBeChecked();
    fireEvent.click(within(devicesSection()).getByLabelText('Cafeteria'));
    fireEvent.click(
      await within(channelsSection()).findByLabelText('Main channel')
    );
    fireEvent.click(
      within(devicesSection()).getByRole('button', { name: 'Remove Lobby' })
    );
    expect(lobby).not.toBeChecked();

    expect(saveButton()).not.toBeDisabled();
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        devices: ['d2'],
        channels: [5],
      })
    );
  });

  it('unchecks a selected result', async () => {
    renderTab();
    fireEvent.click(await within(devicesSection()).findByLabelText('Lobby'));
    expect(
      within(devicesSection()).getByText('No devices assigned')
    ).toBeInTheDocument();
  });

  it('debounces searches', async () => {
    renderTab();
    await waitFor(() =>
      expect(AutomationsService.searchAssignable).toHaveBeenCalledTimes(2)
    );
    vi.useFakeTimers();
    const input = screen.getByRole('searchbox', { name: 'Search devices…' });
    fireEvent.input(input, { target: { value: 'ca' } });
    fireEvent.input(input, { target: { value: 'caf' } });
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(AutomationsService.searchAssignable).toHaveBeenCalledTimes(3);
    expect(AutomationsService.searchAssignable).toHaveBeenLastCalledWith(
      'org-1',
      'devices',
      'caf'
    );
  });

  it('shows empty and failed results', async () => {
    vi.mocked(AutomationsService.searchAssignable).mockImplementation(
      async (_org, kind) => {
        if (kind === 'devices') throw new Error('nope');
        return { count: 0, data: [] };
      }
    );
    renderTab();
    expect(
      await within(devicesSection()).findByText('Could not load the list')
    ).toBeInTheDocument();
    expect(
      await within(channelsSection()).findByText('No matches')
    ).toBeInTheDocument();
  });

  it('shows capability warnings per device and via channels', async () => {
    const warning = {
      rule_id: 'r1',
      device_id: 'd1',
      device_name: 'Lobby',
      missing: 'automation_actions:interrupt',
    };
    renderTab({
      automation: automationFixture({
        devices: [{ id: 'd1', name: 'Lobby' }],
        channels: [{ id: 5, name: 'Main channel' }],
        warnings: [
          warning,
          { ...warning, rule_id: 'r2' },
          {
            ...warning,
            device_id: 'd9',
            device_name: 'Basement',
          },
        ],
      }),
    });
    expect(
      within(devicesSection()).getAllByText(
        'Does not support Interrupt with content'
      )
    ).toHaveLength(1);
    expect(
      screen.getByText('Basement does not support Interrupt with content')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Displays reached through channels')
    ).toBeInTheDocument();
  });

  it('is read-only without edit permission', () => {
    renderTab({ canEdit: false });
    expect(
      screen.queryByRole('button', { name: 'Save assignments' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove Lobby' })
    ).not.toBeInTheDocument();
  });
});
