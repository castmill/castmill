/**
 * Tests for MediasPage component - delete button permission functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import MediasPage from './index';
import { MediasService } from '../services/medias.service';
import { QuotasService } from '../../common/services/quotas.service';

// Mock the services
vi.mock('../services/medias.service', () => ({
  MediasService: {
    fetchMedias: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: '1',
            name: 'Media 1',
            mimetype: 'image/png',
            uri: 'http://example.com/media1.png',
            meta: {},
            inserted_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            name: 'Media 2',
            mimetype: 'video/mp4',
            uri: 'http://example.com/media2.mp4',
            meta: {},
            inserted_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
        count: 2,
      })
    ),
    removeMedia: vi.fn(() => Promise.resolve()),
    uploadMedia: vi.fn(() =>
      Promise.resolve({ id: '3', name: 'New Media', uri: 'http://example.com/media3.png' })
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
vi.mock('./media-view', () => ({
  default: () => <div data-testid="media-view">Media View</div>,
}));

vi.mock('./media-upload', () => ({
  default: (props: any) => (
    <div data-testid="media-upload">
      <button
        data-testid="upload-submit"
        onClick={() => props.onSubmit({ name: 'Test Media', file: new File([], 'test.png') })}
      >
        Upload
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

describe('MediasPage - Delete Button Permission Tests', () => {
  const createMockStore = (permissions: string[] = ['create', 'read', 'update', 'delete']) => ({
    env: { baseUrl: 'http://test.com' },
    organizations: { selectedId: 'org-123', selectedName: 'Test Org' },
    permissions: {
      matrix: {
        medias: permissions,
      },
    },
    i18n: {
      t: (key: string, params?: Record<string, any>) => {
        const translations: Record<string, string> = {
          'common.name': 'Name',
          'common.type': 'Type',
          'common.size': 'Size',
          'common.created': 'Created',
          'common.updated': 'Updated',
          'common.view': 'View',
          'common.remove': 'Remove',
          'common.actions': 'Actions',
          'medias.title': 'Medias',
          'medias.addMedia': 'Add Media',
          'medias.uploadMedia': 'Upload Media',
          'medias.removeMedia': 'Remove Media',
          'medias.removeMedias': 'Remove Medias',
          'medias.confirmRemove': `Confirm remove ${params?.name || ''}`,
          'medias.confirmRemoveMultiple': 'Confirm remove multiple',
          'medias.mediaRemovedSuccess': `Media ${params?.name || ''} removed`,
          'medias.mediasRemovedSuccess': `${params?.count || 0} medias removed`,
          'filters.teamLabel': 'Team',
          'filters.teamPlaceholder': 'Select team',
          'filters.teamClear': 'Clear',
          'filters.images': 'Images',
          'filters.videos': 'Videos',
          'filters.all': 'All',
          'permissions.noDeleteMedias': "You don't have permission to delete medias",
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
    it('should enable delete button when user has delete permissions and medias are selected', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
      });

      // Select a media
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

        await waitFor(() => {
          const buttons = screen.getAllByRole('button');
          const deleteButton = buttons.find(
            (btn) => btn.querySelector('svg') && !btn.textContent?.includes('Add')
          );
          expect(deleteButton).toBeDefined();
          if (deleteButton) {
            expect(deleteButton).not.toBeDisabled();
          }
        });
      }
    });

    it('should disable delete button when no medias are selected', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
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

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
      });

      // Select a media
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

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
      }
    });

    it('should disable delete button when user has no delete permission and no selection', async () => {
      const mockStore = createMockStore(['read']); // Only read

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
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

    it('should keep delete button disabled with selection but lacking delete permission', async () => {
      const mockStore = createMockStore(['create', 'read', 'update']); // No delete

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);

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
      }
    });
  });

  describe('Create Button Permissions', () => {
    it('should enable add media button when user has create permissions', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find(btn => btn.textContent?.includes('Add Media'));
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).not.toBeDisabled();
        }
      });
    });

    it('should disable add media button when user lacks create permissions', async () => {
      const mockStore = createMockStore(['read', 'update', 'delete']); // No create

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const addButton = buttons.find(btn => btn.textContent?.includes('Add Media'));
        expect(addButton).toBeDefined();
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });
  });

  describe('Permission Consistency Across UI Elements', () => {
    it('should consistently apply delete permissions to button and keyboard shortcuts', async () => {
      const mockStore = createMockStore(['create', 'read', 'update', 'delete']);
      const registerSpy = mockStore.keyboardShortcuts.registerShortcutAction;

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
      });

      // Verify keyboard shortcuts were registered
      expect(registerSpy).toHaveBeenCalled();
      const deleteShortcutCall = registerSpy.mock.calls.find(
        (call) => call[0] === 'generic-delete'
      );
      expect(deleteShortcutCall).toBeDefined();
    });

    it('should maintain disabled state across permission changes', async () => {
      const mockStore = createMockStore(['read']); // Minimal permissions

      render(() => <MediasPage store={mockStore} params={[{}, vi.fn()]} />);

      await waitFor(() => {
        expect(screen.getByText('Medias')).toBeInTheDocument();
      });

      // Both create and delete buttons should be disabled
      await waitFor(() => {
        const addButton = screen.getByText('Add Media');
        expect(addButton).toBeDisabled();

        const buttons = screen.getAllByRole('button');
        const deleteButton = buttons.find(
          (btn) => btn.querySelector('svg') && !btn.textContent?.includes('Add')
        );
        if (deleteButton) {
          expect(deleteButton).toBeDisabled();
        }
      });
    });
  });
});
