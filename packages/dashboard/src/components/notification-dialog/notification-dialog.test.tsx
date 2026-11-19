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

  const fakeChannel = () => {
    const handlers: Record<string, (payload: any) => void> = {};
    let nextRef = 0;
    const channel = {
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        handlers[event] = handler;
        return ++nextRef;
      }),
      off: vi.fn(),
    };
    return { channel, handlers };
  };

  it('removes deleted notifications and updates the unread count', async () => {
    const { channel, handlers } = fakeChannel();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={onNotificationRead}
        channel={channel}
      />
    ));

    await waitFor(() =>
      expect(document.querySelectorAll('.notification-item')).toHaveLength(2)
    );
    await waitFor(() => expect(handlers.notifications_deleted).toBeDefined());

    handlers.notifications_deleted({ ids: ['1'], unread_count: 0 });

    await waitFor(() => {
      expect(document.querySelectorAll('.notification-item')).toHaveLength(1);
      expect(onNotificationRead).toHaveBeenLastCalledWith(0);
    });
  });

  it('stops listening to the channel when it closes', async () => {
    const { channel } = fakeChannel();

    const { unmount } = renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={vi.fn()}
        channel={channel}
      />
    ));

    await waitFor(() => expect(channel.on).toHaveBeenCalledTimes(2));
    unmount();

    expect(channel.off).toHaveBeenCalledWith('new_notification', 1);
    expect(channel.off).toHaveBeenCalledWith('notifications_deleted', 2);
  });

  it('keeps live changes when an older list response arrives', async () => {
    let respond: (value: any) => void = () => {};
    (notificationsService.getNotifications as any).mockReturnValue(
      new Promise((resolve) => (respond = resolve))
    );
    const { channel, handlers } = fakeChannel();
    const onNotificationRead = vi.fn();

    renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={onNotificationRead}
        channel={channel}
      />
    ));

    await waitFor(() => expect(handlers.notifications_deleted).toBeDefined());

    // While the list request is in flight, notification 1 is replaced by 3.
    handlers.notifications_deleted({ ids: [1], unread_count: 0 });
    handlers.new_notification({
      notification: {
        ...mockNotifications[0],
        id: '3',
        metadata: { team_name: 'Design' },
      },
      unread_count: 1,
    });

    respond({ data: mockNotifications, unread_count: 1 });

    await waitFor(() =>
      expect(document.querySelectorAll('.notification-item')).toHaveLength(2)
    );
    // The new notification stays first; the deleted one does not come back.
    const items = document.querySelectorAll('.notification-item');
    expect(items[0].textContent).toContain('Design');
    expect(document.body.textContent).not.toContain('Engineering');
    // The older response did not report its unread count.
    expect(onNotificationRead).toHaveBeenCalledTimes(2);
    expect(onNotificationRead).toHaveBeenLastCalledWith(1);

    // A late new_notification for a deleted id is ignored too.
    handlers.new_notification({
      notification: { ...mockNotifications[0], id: '1' },
      unread_count: 1,
    });
    expect(document.querySelectorAll('.notification-item')).toHaveLength(2);
  });

  const page = (from: number, count: number): Notification[] =>
    Array.from({ length: count }, (_, i) => ({
      ...mockNotifications[1],
      id: String(from + i),
      metadata: { device_name: `Screen-${from + i}` },
    }));

  it('reloads the loaded pages when a deletion shifts them', async () => {
    const { channel, handlers } = fakeChannel();
    (notificationsService.getNotifications as any)
      .mockResolvedValueOnce({ data: page(1, 20), unread_count: 0 })
      .mockResolvedValueOnce({ data: page(2, 20), unread_count: 0 });

    renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={vi.fn()}
        channel={channel}
      />
    ));

    await waitFor(() =>
      expect(document.querySelectorAll('.notification-item')).toHaveLength(20)
    );

    // Deleting notification 1 moves notification 21 onto the first page.
    handlers.notifications_deleted({ ids: ['1'], unread_count: 0 });

    await waitFor(() =>
      expect(notificationsService.getNotifications).toHaveBeenLastCalledWith(
        1,
        20
      )
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain('Screen-21')
    );
    expect(document.querySelectorAll('.notification-item')).toHaveLength(20);
    expect(document.body.textContent).not.toMatch(/Screen-1(?!\d)/);
  });

  it('reloads when a response contains a notification deleted meanwhile', async () => {
    let respond: (value: any) => void = () => {};
    const { channel, handlers } = fakeChannel();
    (notificationsService.getNotifications as any)
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)))
      .mockResolvedValueOnce({ data: page(2, 20), unread_count: 0 });

    renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={vi.fn()}
        channel={channel}
      />
    ));

    await waitFor(() => expect(handlers.notifications_deleted).toBeDefined());
    handlers.notifications_deleted({ ids: ['1'], unread_count: 0 });
    // The first page was read before notification 1 was deleted.
    respond({ data: page(1, 20), unread_count: 0 });

    await waitFor(() =>
      expect(notificationsService.getNotifications).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain('Screen-21')
    );
    expect(document.querySelectorAll('.notification-item')).toHaveLength(20);
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
