/**
 * Tests for DevicesPage component - delete button permission functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import DevicesPage from './index';
import { DevicesService } from '../services/devices.service';
import { QuotasService } from '../../common/services/quotas.service';

// Mock the services
vi.mock('../services/devices.service', () => ({
  DevicesService: {
    fetchDevices: vi.fn(() =>
      Promise.resolve({
        data: [
          { id: '1', name: 'Device 1', online: true },
          { id: '2', name: 'Device 2', online: false },
        ],
        count: 2,
      })
    ),
    removeDevice: vi.fn(() => Promise.resolve()),
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

// Mock child components
vi.mock('./device-view', () => ({
  default: () => <div data-testid="device-view">Device View</div>,
}));

vi.mock('./register-device', () => ({
  default: (props: any) => (
    <div data-testid="register-device">
      <button
        data-testid="register-submit"
        onClick={() => props.onSubmit({ name: 'Test Device', pincode: '1234' })}
      >
        Submit
      </button>
    </div>
  ),
}));

vi.mock('../../common/hooks', () => ({
  useTeamFilter: () => ({
    teams: () => [],
    selectedTeamId: () => null,
    setSelectedTeamId: vi.fn(),
  }),
}));

// Mock ResourcesObserver
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    ResourcesObserver: vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      cleanup: vi.fn(),
    })),
  };
});

describe('DevicesPage - Delete Button Permission Tests', () => {
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
      t: (key: string, params?: Record<string, any>) => {
        const translations: Record<string, string> = {
          'common.name': 'Name',
          'common.online': 'Online',
          'common.offline': 'Offline',
          'common.timezone': 'Timezone',
          'common.version': 'Version',
          'common.ip': 'IP',
          'common.id': 'ID',
          'common.view': 'View',
          'common.remove': 'Remove',
          'common.actions': 'Actions',
          'devices.title': 'Devices',
          'devices.addDevice': 'Add Device',
          'devices.registerDevice': 'Register Device',
          'devices.deviceDetails': 'Device Details',
          'devices.removeDevice': 'Remove Device',
          'devices.removeDevices': 'Remove Devices',
          'devices.confirmRemove': `Confirm remove ${params?.name || ''}`,
          'devices.confirmRemoveMultiple': 'Confirm remove multiple',
          'devices.deviceRemovedSuccess': `Device ${params?.name || ''} removed`,
          'devices.devicesRemovedSuccess': `${params?.count || 0} devices removed`,
          'devices.errorRemovingDevice': `Error removing ${params?.name || ''}`,
          'devices.errorRemovingDevices': 'Error removing devices',
          'filters.teamLabel': 'Team',
          'filters.teamPlaceholder': 'Select team',
          'filters.teamClear': 'Clear',
          'permissions.noDeleteDevices':
            "You don't have permission to delete devices",
        };
        return translations[key] || key;
      },
    },
    socket: null,
    keyboardShortcuts: {
      registerShortcutAction: vi.fn(),
      unregisterShortcutAction: vi.fn(),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Delete Button with Full Permissions', () => {
    it('should enable delete button when user has delete permissions and devices are selected', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });

      // Select a device by finding checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]); // Click first data row checkbox

        await waitFor(() => {
          // Find the delete button in toolbar
          const buttons = screen.getAllByRole('button');
          const deleteButton = buttons.find(
            (btn) =>
              btn.querySelector('svg') && !btn.textContent?.includes('Add')
          );
          expect(deleteButton).toBeDefined();
          if (deleteButton) {
            expect(deleteButton).not.toBeDisabled();
          }
        });
      }
    });

    it('should disable delete button when no devices are selected', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });

      // Don't select any devices
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const deleteButton = buttons.find(
          (btn) => btn.querySelector('svg') && !btn.textContent?.includes('Add')
        );
        expect(deleteButton).toBeDefined();
        if (deleteButton) {
          expect(deleteButton).toBeDisabled();
        }
      });
    });
  });

  describe('Delete Button without Delete Permissions', () => {
    it('should disable delete button when user lacks delete permissions', async () => {
      // User has all permissions except delete
      const mockStore = createMockStore(['create', 'read', 'update']);

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });

      // Try to select a device
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

        await waitFor(() => {
          // Delete button should be disabled due to lack of permissions
          const buttons = screen.getAllByRole('button');
          const deleteButton = buttons.find(
            (btn) =>
              btn.querySelector('svg') && !btn.textContent?.includes('Add')
          );
          expect(deleteButton).toBeDefined();
          if (deleteButton) {
            expect(deleteButton).toBeDisabled();
          }
        });
      }
    });

    it('should disable delete button when user has no permissions and no selection', async () => {
      const mockStore = createMockStore(['read']); // Only read permission

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });

      // Delete button should be disabled for both reasons
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const deleteButton = buttons.find(
          (btn) => btn.querySelector('svg') && !btn.textContent?.includes('Add')
        );
        expect(deleteButton).toBeDefined();
        if (deleteButton) {
          expect(deleteButton).toBeDisabled();
        }
      });
    });

    it('should disable delete button even when devices are selected but user lacks permission', async () => {
      const mockStore = createMockStore(['create', 'read', 'update']); // No delete

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });

      // Select a device
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

        await waitFor(() => {
          // Button should still be disabled due to lack of delete permission
          const buttons = screen.getAllByRole('button');
          const deleteButton = buttons.find(
            (btn) =>
              btn.querySelector('svg') && !btn.textContent?.includes('Add')
          );
          expect(deleteButton).toBeDefined();
          if (deleteButton) {
            expect(deleteButton).toBeDisabled();
          }
        });
      }
    });
  });

  describe('Create Button Permissions', () => {
    it('should enable add device button when user has create permissions', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        // The button has the text inside it
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find((btn) =>
          btn.textContent?.includes('Add Device')
        );
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).not.toBeDisabled();
        }
      });
    });

    it('should disable add device button when user lacks create permissions', async () => {
      const mockStore = createMockStore(['read', 'update', 'delete']); // No create

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        // The button has the text inside it
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find((btn) =>
          btn.textContent?.includes('Add Device')
        );
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should register keyboard shortcuts with permission checks', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);
      const registerSpy = mockStore.keyboardShortcuts.registerShortcutAction;

      render(() => <DevicesPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Devices')).toBeInTheDocument();
      });

      // Verify that keyboard shortcuts were registered
      expect(registerSpy).toHaveBeenCalled();

      // Check that delete shortcut was registered
      const deleteShortcutCall = registerSpy.mock.calls.find(
        (call) => call[0] === 'generic-delete'
      );
      expect(deleteShortcutCall).toBeDefined();
    });
  });
});
