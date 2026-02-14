import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ChannelsPage from './channels-page';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '@castmill/ui-common';
import * as storeModule from '../../store/store';

// Mock the channels service
vi.mock('../../services/channels.service', () => ({
  ChannelsService: vi.fn().mockImplementation(() => ({
    fetchChannels: vi.fn(() =>
      Promise.resolve({
        data: [
          { id: 1, name: 'Channel 1' },
          { id: 2, name: 'Channel 2' },
        ],
        count: 2,
      })
    ),
    removeChannel: vi.fn(() => Promise.resolve({ success: true })),
    addChannel: vi.fn(() =>
      Promise.resolve({ data: { id: 3, name: 'New Channel' } })
    ),
    updateChannel: vi.fn(() =>
      Promise.resolve({ id: 1, name: 'Updated Channel' })
    ),
  })),
  JsonChannel: {} as any,
}));

// Mock the quotas service
vi.mock('../../services/quotas.service', () => ({
  QuotasService: {
    getResourceQuota: vi.fn(() =>
      Promise.resolve({
        used: 2,
        total: 10,
      })
    ),
  },
  ResourceQuota: {} as any,
}));

// Mock the hooks
vi.mock('../../hooks', () => ({
  useTeamFilter: () => ({
    teams: () => [],
    selectedTeamId: () => null,
    setSelectedTeamId: vi.fn(),
  }),
  useModalFromUrl: vi.fn(),
}));

const { mockUsePermissions } = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
}));
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: mockUsePermissions,
}));

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    registerShortcutAction: vi.fn(),
    unregisterShortcutAction: vi.fn(),
  }),
}));

vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [{}, vi.fn()],
  useLocation: () => ({
    pathname: '/channels',
  }),
}));

describe('ChannelsPage - Delete Button Permission Tests', () => {
  let mockCanPerformAction: any;

  const renderWithProviders = (component: () => any) => {
    return render(() => (
      <I18nProvider>
        <ToastProvider>{component()}</ToastProvider>
      </I18nProvider>
    ));
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock the store
    vi.spyOn(storeModule, 'store', 'get').mockReturnValue({
      organizations: {
        selectedId: 'org-123',
        selectedName: 'Test Org',
      },
    } as any);

    // Get the mock function
    mockCanPerformAction = vi.fn((resource: string, action: string) => true);
    mockUsePermissions.mockReturnValue({
      canPerformAction: mockCanPerformAction,
    });
  });

  describe('Delete Button Permissions', () => {
    it('should enable delete button when user has delete permissions and items are selected', async () => {
      // Mock user with delete permissions
      mockCanPerformAction.mockImplementation(
        (resource: string, action: string) => {
          if (resource === 'channels' && action === 'delete') return true;
          return true;
        }
      );

      renderWithProviders(() => <ChannelsPage />);

      await waitFor(() => {
        expect(screen.getByText('Channels')).toBeInTheDocument();
      });

      // Find the table and select a channel
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]); // Click first data row checkbox

        await waitFor(() => {
          // Find the delete button (IconButton in toolbar)
          const deleteButtons = screen.getAllByRole('button');
          const deleteButton = deleteButtons.find((btn) =>
            btn.querySelector('svg')
          );
          expect(deleteButton).toBeDefined();
          if (deleteButton) {
            expect(deleteButton).not.toBeDisabled();
          }
        });
      }
    });

    it('should disable delete button when user lacks delete permissions', async () => {
      // Mock user WITHOUT delete permissions
      mockCanPerformAction.mockImplementation(
        (resource: string, action: string) => {
          if (resource === 'channels' && action === 'delete') return false;
          if (resource === 'channels' && action === 'create') return true;
          return true;
        }
      );

      renderWithProviders(() => <ChannelsPage />);

      await waitFor(() => {
        expect(screen.getByText('Channels')).toBeInTheDocument();
      });

      // Find the table and try to select a channel
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]); // Click first data row checkbox

        await waitFor(() => {
          // Find the delete button - it should be disabled
          const deleteButtons = screen.getAllByRole('button');
          const deleteButton = deleteButtons.find((btn) =>
            btn.querySelector('svg')
          );
          expect(deleteButton).toBeDefined();
          if (deleteButton) {
            expect(deleteButton).toBeDisabled();
          }
        });
      }
    });

    it('should not render delete button when no items are selected even with permissions', async () => {
      // Mock user WITH delete permissions
      mockCanPerformAction.mockImplementation(
        (resource: string, action: string) => {
          if (resource === 'channels' && action === 'delete') return true;
          return true;
        }
      );

      renderWithProviders(() => <ChannelsPage />);

      await waitFor(() => {
        expect(screen.getByText('Channels')).toBeInTheDocument();
      });

      // Don't select any items — the delete button lives inside selectionActions
      // which only renders when items are selected, so it should be absent.
      const deleteButton = screen.queryByText('common.delete');
      expect(deleteButton).toBeNull();
    });

    it('should not render delete button when user lacks delete permissions AND no items selected', async () => {
      // Mock user WITHOUT delete permissions
      mockCanPerformAction.mockImplementation(
        (resource: string, action: string) => {
          if (resource === 'channels' && action === 'delete') return false;
          return true;
        }
      );

      renderWithProviders(() => <ChannelsPage />);

      await waitFor(() => {
        expect(screen.getByText('Channels')).toBeInTheDocument();
      });

      // Don't select any items — the delete button lives inside selectionActions
      // which only renders when items are selected, so it should be absent.
      const deleteButton = screen.queryByText('common.delete');
      expect(deleteButton).toBeNull();
    });
  });

  describe('Create Button Permissions', () => {
    it('should enable create button when user has create permissions', async () => {
      mockCanPerformAction.mockImplementation(
        (resource: string, action: string) => {
          if (resource === 'channels' && action === 'create') return true;
          return true;
        }
      );

      renderWithProviders(() => <ChannelsPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find((btn) =>
          btn.textContent?.includes('Add Channel')
        );
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).not.toBeDisabled();
        }
      });
    });

    it('should disable create button when user lacks create permissions', async () => {
      mockCanPerformAction.mockImplementation(
        (resource: string, action: string) => {
          if (resource === 'channels' && action === 'create') return false;
          return true;
        }
      );

      renderWithProviders(() => <ChannelsPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find((btn) =>
          btn.textContent?.includes('Add Channel')
        );
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });
  });
});
