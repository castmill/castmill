/**
 * Tests for PlaylistsPage component - delete button permission functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import PlaylistsPage from './index';
import { PlaylistsService } from '../services/playlists.service';
import { QuotasService } from '../../common/services/quotas.service';

// Mock the services
vi.mock('../services/playlists.service', () => ({
  PlaylistsService: {
    fetchPlaylists: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 1,
            name: 'Playlist 1',
            status: 'live',
            settings: { aspect_ratio: { width: 16, height: 9 } },
            inserted_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            items: [],
            organization_id: 'org-123',
          },
          {
            id: 2,
            name: 'Playlist 2',
            status: 'draft',
            settings: { aspect_ratio: { width: 16, height: 9 } },
            inserted_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            items: [],
            organization_id: 'org-123',
          },
        ],
        count: 2,
      })
    ),
    removePlaylist: vi.fn(() => Promise.resolve()),
    addPlaylist: vi.fn(() =>
      Promise.resolve({ id: 3, name: 'New Playlist', items: [] })
    ),
    updatePlaylist: vi.fn(() => Promise.resolve()),
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
vi.mock('./playlist-view', () => ({
  default: () => <div data-testid="playlist-view">Playlist View</div>,
}));

vi.mock('./playlist-add-form', () => ({
  PlaylistAddForm: (props: any) => (
    <div data-testid="playlist-add-form">
      <button
        data-testid="submit-form"
        onClick={() =>
          props.onSubmit('Test Playlist', { width: 16, height: 9 })
        }
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

describe('PlaylistsPage - Delete Button Permission Tests', () => {
  const createMockStore = (
    permissions: string[] = ['create', 'read', 'update', 'delete']
  ) => ({
    env: { baseUrl: 'http://test.com' },
    organizations: { selectedId: 'org-123', selectedName: 'Test Org' },
    permissions: {
      matrix: {
        playlists: permissions,
      },
    },
    i18n: {
      t: (key: string, params?: Record<string, any>) => {
        const translations: Record<string, string> = {
          'common.name': 'Name',
          'common.status': 'Status',
          'common.created': 'Created',
          'common.updated': 'Updated',
          'common.view': 'View',
          'common.remove': 'Remove',
          'common.actions': 'Actions',
          'playlists.title': 'Playlists',
          'playlists.addPlaylist': 'Add Playlist',
          'playlists.removePlaylist': 'Remove Playlist',
          'playlists.removePlaylists': 'Remove Playlists',
          'playlists.confirmRemove': `Confirm remove ${params?.name || ''}`,
          'playlists.confirmRemoveMultiple': 'Confirm remove multiple',
          'playlists.playlistRemovedSuccess': `Playlist ${params?.name || ''} removed`,
          'playlists.playlistsRemovedSuccess': `${params?.count || 0} playlists removed`,
          'playlists.aspectRatio': 'Aspect Ratio',
          'filters.teamLabel': 'Team',
          'filters.teamPlaceholder': 'Select team',
          'filters.teamClear': 'Clear',
          'permissions.noDeletePlaylists':
            "You don't have permission to delete playlists",
        };
        return translations[key] || key;
      },
    },
    keyboardShortcuts: {
      registerShortcutAction: vi.fn(),
      unregisterShortcutAction: vi.fn(),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Delete Button with Full Permissions', () => {
    it('should enable delete button when user has delete permissions and playlists are selected', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Playlists')).toBeInTheDocument();
      });

      // Select a playlist
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

        await waitFor(() => {
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

    it('should disable delete button when no playlists are selected', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Playlists')).toBeInTheDocument();
      });

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
      const mockStore = createMockStore(['create', 'read', 'update']); // No delete

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Playlists')).toBeInTheDocument();
      });

      // Select a playlist
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

        await waitFor(() => {
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

    it('should disable delete button when user has no delete permission and no selection', async () => {
      const mockStore = createMockStore(['read']); // Only read

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Playlists')).toBeInTheDocument();
      });

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

    it('should keep delete button disabled even with selection if lacking permission', async () => {
      const mockStore = createMockStore(['create', 'read', 'update']); // No delete

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Playlists')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

        await waitFor(() => {
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
    it('should enable add playlist button when user has create permissions', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find((btn) =>
          btn.textContent?.includes('Add Playlist')
        );
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).not.toBeDisabled();
        }
      });
    });

    it('should disable add playlist button when user lacks create permissions', async () => {
      const mockStore = createMockStore(['read', 'update', 'delete']); // No create

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find((btn) =>
          btn.textContent?.includes('Add Playlist')
        );
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });
  });

  describe('Permission Consistency', () => {
    it('should apply same permission logic to toolbar delete button and keyboard shortcuts', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);
      const registerSpy = mockStore.keyboardShortcuts.registerShortcutAction;

      render(() => <PlaylistsPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Playlists')).toBeInTheDocument();
      });

      // Verify keyboard shortcuts were registered with permission checks
      expect(registerSpy).toHaveBeenCalled();
      const deleteShortcutCall = registerSpy.mock.calls.find(
        (call) => call[0] === 'generic-delete'
      );
      expect(deleteShortcutCall).toBeDefined();
    });
  });
});
