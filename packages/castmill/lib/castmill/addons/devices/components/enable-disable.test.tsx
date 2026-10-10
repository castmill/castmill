/**
 * Tests for DevicesPage component - enable/disable device functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@solidjs/testing-library';
import DevicesPage from './index';
import { DevicesService } from '../services/devices.service';

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    fetchDevices: vi.fn(() =>
      Promise.resolve({
        data: [
          { id: '1', name: 'Device 1', online: true, enabled: true },
          { id: '2', name: 'Device 2', online: false, enabled: false },
        ],
        count: 2,
      })
    ),
    removeDevice: vi.fn(() => Promise.resolve()),
    updateDevice: vi.fn(() => Promise.resolve()),
    registerDevice: vi.fn(() =>
      Promise.resolve({ id: '3', name: 'New Device' })
    ),
  },
}));

vi.mock('../../common/services/quotas.service', () => ({
  QuotasService: vi.fn().mockImplementation(() => ({
    getResourceQuota: vi.fn(() =>
      Promise.resolve({
        used: 2,
        total: 10,
      })
    ),
  })),
}));

vi.mock('./device-view', () => ({
  default: () => <div data-testid="device-view">Device View</div>,
}));

vi.mock('./register-device', () => ({
  default: () => <div data-testid="register-device" />,
}));

vi.mock('../../common/hooks', () => ({
  useTeamFilter: () => ({
    teams: () => [],
    selectedTeamId: () => null,
    setSelectedTeamId: vi.fn(),
  }),
  useModalFromUrl: () => {},
}));

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    ResourcesObserver: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      cleanup: vi.fn(),
    })),
    TagsService: vi.fn().mockImplementation(() => ({
      listTagGroups: vi.fn().mockResolvedValue([]),
      listTags: vi.fn().mockResolvedValue([]),
      getResourceTags: vi.fn().mockResolvedValue([]),
    })),
  };
});

const translations: Record<string, string> = {
  'devices.enabled': 'Enabled',
  'devices.disabled': 'Disabled',
  'devices.enableDevice': 'Enable device',
  'devices.disableDevice': 'Disable device',
  'devices.deviceEnabledSuccess': 'Device enabled',
  'devices.deviceDisabledSuccess': 'Device disabled',
  'devices.errorUpdatingDevice': 'Error updating device',
};

const createMockStore = (
  permissions: string[] = ['create', 'read', 'update', 'delete']
) => ({
  env: { baseUrl: 'http://test.com' },
  organizations: { selectedId: 'org-123', selectedName: 'Test Org' },
  permissions: {
    matrix: {
      devices: permissions,
    },
  },
  i18n: {
    t: (key: string) => translations[key] || key,
  },
  socket: null,
  keyboardShortcuts: {
    registerShortcutAction: vi.fn(),
    unregisterShortcutAction: vi.fn(),
  },
});

vi.spyOn(console, 'error').mockImplementation(() => {});

describe('DevicesPage - Enable/Disable Device', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders enabled/disabled toggle state per device', async () => {
    const { container } = render(() => (
      <DevicesPage store={createMockStore()} params={[{}, vi.fn()]} />
    ));

    await waitFor(() => {
      expect(
        container.querySelector('.device-enabled-toggle.enabled')
      ).not.toBeNull();
      expect(
        container.querySelector('.device-enabled-toggle.disabled')
      ).not.toBeNull();
    });
  });

  it('calls updateDevice with enabled=false when disabling an enabled device', async () => {
    const { container } = render(() => (
      <DevicesPage store={createMockStore()} params={[{}, vi.fn()]} />
    ));

    const enabledToggle = await waitFor(() => {
      const el = container.querySelector('.device-enabled-toggle.enabled');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.click(enabledToggle);

    await waitFor(() => {
      expect(DevicesService.updateDevice).toHaveBeenCalledWith(
        'http://test.com',
        'org-123',
        '1',
        { enabled: false }
      );
    });
  });

  it('calls updateDevice with enabled=true when enabling a disabled device', async () => {
    const { container } = render(() => (
      <DevicesPage store={createMockStore()} params={[{}, vi.fn()]} />
    ));

    const disabledToggle = await waitFor(() => {
      const el = container.querySelector('.device-enabled-toggle.disabled');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.click(disabledToggle);

    await waitFor(() => {
      expect(DevicesService.updateDevice).toHaveBeenCalledWith(
        'http://test.com',
        'org-123',
        '2',
        { enabled: true }
      );
    });
  });

  it('optimistically updates the toggle and rolls back if the request fails', async () => {
    let rejectUpdate: ((reason?: unknown) => void) | undefined;
    vi.mocked(DevicesService.updateDevice).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectUpdate = reject;
      }) as Promise<void>
    );

    const { container } = render(() => (
      <DevicesPage store={createMockStore()} params={[{}, vi.fn()]} />
    ));

    const enabledToggle = await waitFor(() => {
      const el = container.querySelector('.device-enabled-toggle.enabled');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    fireEvent.click(enabledToggle);

    await waitFor(() => {
      expect(
        container.querySelectorAll('.device-enabled-toggle.enabled').length
      ).toBe(0);
      expect(
        container.querySelectorAll('.device-enabled-toggle.disabled').length
      ).toBe(2);
    });

    rejectUpdate?.(new Error('Request failed'));

    await waitFor(() => {
      expect(
        container.querySelectorAll('.device-enabled-toggle.enabled').length
      ).toBe(1);
      expect(
        container.querySelectorAll('.device-enabled-toggle.disabled').length
      ).toBe(1);
    });
  });

  it('does not call updateDevice when the user lacks update permission', async () => {
    const { container } = render(() => (
      <DevicesPage store={createMockStore(['read'])} params={[{}, vi.fn()]} />
    ));

    const enabledToggle = await waitFor(() => {
      const el = container.querySelector('.device-enabled-toggle.enabled');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    fireEvent.click(enabledToggle);

    // Give any async handlers a chance to run
    await new Promise((r) => setTimeout(r, 50));

    expect(DevicesService.updateDevice).not.toHaveBeenCalled();
  });
});
