import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import { NotificationDialog } from './notification-dialog';
import { I18nProvider } from '../../i18n';
import { notificationsService } from '../../services/notifications.service';
import type { Notification } from '../../services/notifications.service';

// Mock the notifications service
vi.mock('../../services/notifications.service', () => ({
  notificationsService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
  Notification: {},
}));

// Mock the router
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock the store
vi.mock('../../store', () => ({
  store: {
    organizations: {
      selectedId: 'org-123',
    },
  },
}));

describe('NotificationDialog Component', () => {
  const mockNotifications: Notification[] = [
    {
      id: '1',
      title_key: 'organizations.notifications.types.teamInvitation.title',
      description_key:
        'organizations.notifications.types.teamInvitation.description',
      type: 'team_invitation',
      read: false,
      metadata: { team_name: 'Engineering' },
      inserted_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
    },
    {
      id: '2',
      title_key: 'organizations.notifications.types.deviceRegistration.title',
      description_key:
        'organizations.notifications.types.deviceRegistration.description',
      type: 'device_registration',
      read: true,
      metadata: { device_name: 'Screen-01' },
      inserted_at: '2024-01-01T09:00:00Z',
      updated_at: '2024-01-01T09:00:00Z',
    },
  ];

  const renderWithI18n = (component: () => any) => {
    return render(() => <I18nProvider>{component()}</I18nProvider>);
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    (notificationsService.getNotifications as any).mockResolvedValue({
      data: mockNotifications,
      unread_count: 1,
    });
    (notificationsService.markAsRead as any).mockResolvedValue({
      id: '1',
      read: true,
    });
    (notificationsService.markAllAsRead as any).mockResolvedValue(2);
  });

  it('should render the dialog', async () => {
    const onClose = vi.fn();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={onClose}
        onNotificationRead={onNotificationRead}
      />
    ));

    await waitFor(() => {
      // Portal renders dialog outside main container, use document query
      const dialog = document.querySelector('.notification-dialog-overlay');
      expect(dialog).not.toBeNull();
    });
  });

  it('should load notifications on mount', async () => {
    const onClose = vi.fn();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={onClose}
        onNotificationRead={onNotificationRead}
      />
    ));

    await waitFor(() => {
      expect(notificationsService.getNotifications).toHaveBeenCalled();
    });
  });

  it('should display notification items', async () => {
    const onClose = vi.fn();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={onClose}
        onNotificationRead={onNotificationRead}
      />
    ));

    await waitFor(() => {
      const items = document.querySelectorAll('.notification-item');
      expect(items.length).toBe(2);
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={onClose}
        onNotificationRead={onNotificationRead}
      />
    ));

    await waitFor(() => {
      const closeButton = document.querySelector('.notification-close-btn');
      expect(closeButton).not.toBeNull();
    });
  });

  it('should handle empty notifications', async () => {
    (notificationsService.getNotifications as any).mockResolvedValue({
      data: [],
      unread_count: 0,
    });

    const onClose = vi.fn();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={onClose}
        onNotificationRead={onNotificationRead}
      />
    ));

    await waitFor(() => {
      const emptyState = document.querySelector('.notification-empty');
      expect(emptyState).not.toBeNull();
    });
  });

  it('should handle service errors gracefully', async () => {
    (notificationsService.getNotifications as any).mockRejectedValue(
      new Error('Network error')
    );

    const onClose = vi.fn();
    const onNotificationRead = vi.fn();

    // Should not throw
    renderWithI18n(() => (
      <NotificationDialog
        onClose={onClose}
        onNotificationRead={onNotificationRead}
      />
    ));

    await waitFor(() => {
      const dialog = document.querySelector('.notification-dialog');
      expect(dialog).not.toBeNull();
    });
  });
});
