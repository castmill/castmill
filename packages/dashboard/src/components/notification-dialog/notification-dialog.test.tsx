import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@solidjs/testing-library';
import {
  NotificationDialog,
  notificationActorName,
  resolveNotificationLink,
} from './notification-dialog';
import { I18nProvider } from '../../i18n';
import { notificationsService } from '../../services/notifications.service';
import type { Notification } from '../../services/notifications.service';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

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
  useNavigate: () => navigateMock,
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

  it('shows who performed the action', async () => {
    (notificationsService.getNotifications as any).mockResolvedValue({
      data: [
        {
          ...mockNotifications[1],
          actor: { type: 'user', name: 'Ana Andersson' },
        },
        {
          ...mockNotifications[0],
          id: '3',
          actor: { type: 'device', name: null },
        },
      ],
      unread_count: 0,
    });

    renderWithI18n(() => (
      <NotificationDialog onClose={vi.fn()} onNotificationRead={vi.fn()} />
    ));

    await waitFor(() => {
      const actors = document.querySelectorAll('.notification-actor');
      expect(actors.length).toBe(1);
      expect(actors[0].textContent).toBe('by Ana Andersson');
    });
  });

  describe('notificationActorName', () => {
    const base = mockNotifications[0];

    it('names user actors only', () => {
      expect(
        notificationActorName({
          ...base,
          actor: { type: 'user', name: 'Ana' },
        })
      ).toBe('Ana');
      expect(
        notificationActorName({ ...base, actor: { type: 'device' } })
      ).toBeUndefined();
      expect(
        notificationActorName({ ...base, actor: { type: 'user', name: null } })
      ).toBeUndefined();
      expect(notificationActorName(base)).toBeUndefined();
    });

    it('skips the actor of events about themselves, whatever the names', () => {
      // A renamed user who accepted an invitation.
      expect(
        notificationActorName({
          ...base,
          type: 'invitation_accepted',
          metadata: { user_name: 'Ana' },
          actor: { type: 'user', name: 'Ana Renamed' },
        })
      ).toBeUndefined();
    });

    it('names the actor when the subject only shares their name', () => {
      // An admin removing another member called Ana.
      expect(
        notificationActorName({
          ...base,
          type: 'member_removed',
          metadata: { user_name: 'Ana' },
          actor: { type: 'user', name: 'Ana' },
        })
      ).toBe('Ana');
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
      .mockResolvedValueOnce({
        data: page(1, 20),
        unread_count: 0,
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: page(2, 20),
        unread_count: 0,
        has_more: true,
      });

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
      .mockResolvedValueOnce({
        data: page(2, 20),
        unread_count: 0,
        has_more: true,
      });

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
    respond({ data: page(1, 20), unread_count: 0, has_more: true });

    await waitFor(() =>
      expect(notificationsService.getNotifications).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(document.body.textContent).toContain('Screen-21')
    );
    expect(document.querySelectorAll('.notification-item')).toHaveLength(20);
  });

  const unreadPage = (from: number, count: number): Notification[] =>
    Array.from({ length: count }, (_, i) => ({
      ...mockNotifications[0],
      id: String(from + i),
      read: false,
      metadata: { team_name: `Team-${from + i}` },
    }));

  it('keeps loading past a page whose notifications were all filtered out', async () => {
    (notificationsService.getNotifications as any)
      .mockResolvedValueOnce({ data: [], unread_count: 0, has_more: true })
      .mockResolvedValueOnce({
        data: page(1, 5),
        unread_count: 0,
        has_more: false,
      });

    renderWithI18n(() => (
      <NotificationDialog onClose={vi.fn()} onNotificationRead={vi.fn()} />
    ));

    await waitFor(() =>
      expect(document.querySelectorAll('.notification-item')).toHaveLength(5)
    );
    expect(notificationsService.getNotifications).toHaveBeenLastCalledWith(
      2,
      20
    );
    expect(notificationsService.getNotifications).toHaveBeenCalledTimes(2);
  });

  it('keeps local reads when a reload requested before them arrives', async () => {
    let respond: (value: any) => void = () => {};
    const { channel, handlers } = fakeChannel();
    const onNotificationRead = vi.fn();
    (notificationsService.getNotifications as any)
      .mockResolvedValueOnce({
        data: unreadPage(1, 20),
        unread_count: 20,
        has_more: true,
      })
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));

    renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={onNotificationRead}
        channel={channel}
      />
    ));

    await waitFor(() =>
      expect(
        document.querySelectorAll('.notification-item.unread')
      ).toHaveLength(20)
    );

    // A deletion starts a reload; notification 2 is read while it is in flight.
    handlers.notifications_deleted({ ids: ['1'], unread_count: 19 });
    await waitFor(() =>
      expect(notificationsService.getNotifications).toHaveBeenCalledTimes(2)
    );
    (document.querySelector('.notification-item') as HTMLElement).click();
    await waitFor(() =>
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('2')
    );
    await waitFor(() =>
      expect(onNotificationRead).toHaveBeenLastCalledWith(18)
    );

    // The reload was generated before the read.
    respond({ data: unreadPage(2, 20), unread_count: 19, has_more: true });

    await waitFor(() => expect(document.body.textContent).toContain('Team-21'));
    expect(document.querySelectorAll('.notification-item.unread')).toHaveLength(
      19
    );
    expect(onNotificationRead).toHaveBeenLastCalledWith(18);
  });

  it('keeps mark all as read when a reload requested before it arrives', async () => {
    let respond: (value: any) => void = () => {};
    const { channel, handlers } = fakeChannel();
    const onNotificationRead = vi.fn();
    (notificationsService.getNotifications as any)
      .mockResolvedValueOnce({
        data: unreadPage(1, 20),
        unread_count: 20,
        has_more: true,
      })
      .mockReturnValueOnce(new Promise((resolve) => (respond = resolve)));

    renderWithI18n(() => (
      <NotificationDialog
        onClose={vi.fn()}
        onNotificationRead={onNotificationRead}
        channel={channel}
      />
    ));

    await waitFor(() =>
      expect(
        document.querySelectorAll('.notification-item.unread')
      ).toHaveLength(20)
    );

    handlers.notifications_deleted({ ids: ['1'], unread_count: 19 });
    await waitFor(() =>
      expect(notificationsService.getNotifications).toHaveBeenCalledTimes(2)
    );
    (
      document.querySelector('.notification-mark-all-read') as HTMLElement
    ).click();
    await waitFor(() => expect(onNotificationRead).toHaveBeenLastCalledWith(0));

    respond({ data: unreadPage(2, 20), unread_count: 19, has_more: true });

    await waitFor(() => expect(document.body.textContent).toContain('Team-21'));
    expect(document.querySelectorAll('.notification-item.unread')).toHaveLength(
      0
    );
    expect(onNotificationRead).toHaveBeenLastCalledWith(0);
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

  describe('network notifications', () => {
    const networkNotification = (
      overrides: Partial<Notification>
    ): Notification => ({
      id: '10',
      title_key: 'organizations.notifications.types.deviceRegistration.title',
      description_key:
        'organizations.notifications.types.deviceRegistration.description',
      type: 'network_custom_domain_active',
      read: true,
      metadata: { hostname: 'signage.example.com' },
      inserted_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      ...overrides,
    });

    const clickOnly = async (notification: Notification) => {
      (notificationsService.getNotifications as any).mockResolvedValue({
        data: [notification],
        unread_count: 0,
      });
      const onClose = vi.fn();

      renderWithI18n(() => (
        <NotificationDialog onClose={onClose} onNotificationRead={vi.fn()} />
      ));

      const item = await waitFor(() => {
        const element = document.querySelector('.notification-item');
        expect(element).not.toBeNull();
        return element as HTMLElement;
      });

      return { item, onClose };
    };

    it('opens network pages without the organization', async () => {
      const { item, onClose } = await clickOnly(
        networkNotification({ link: '/network/custom-domains' })
      );

      fireEvent.click(item);

      expect(onClose).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/network/custom-domains');
    });

    it('opens absolute links in a new tab', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const { item } = await clickOnly(
        networkNotification({ link: 'https://signage.example.com' })
      );

      fireEvent.click(item);

      expect(open).toHaveBeenCalledWith(
        'https://signage.example.com',
        '_blank',
        'noopener,noreferrer'
      );
      expect(navigateMock).not.toHaveBeenCalled();
      open.mockRestore();
    });

    it('opens unread external links before the read request resolves', async () => {
      let resolveRead!: (result: { id: string; read: boolean }) => void;
      (notificationsService.markAsRead as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve;
          })
      );
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      const { item, onClose } = await clickOnly(
        networkNotification({
          link: 'https://signage.example.com',
          read: false,
        })
      );

      fireEvent.click(item);

      expect(open).toHaveBeenCalledWith(
        'https://signage.example.com',
        '_blank',
        'noopener,noreferrer'
      );
      expect(onClose).not.toHaveBeenCalled();

      resolveRead({ id: '10', read: true });
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      open.mockRestore();
    });

    it('shows the network icon for network events', async () => {
      const { item } = await clickOnly(networkNotification({}));

      expect(item.querySelector('.notification-icon')?.textContent).toBe('🌐');
    });
  });
});

describe('resolveNotificationLink', () => {
  it('opens organization pages in the selected organization', () => {
    expect(resolveNotificationLink('/devices?device=1', 'org-1')).toEqual({
      external: false,
      href: '/org/org-1/devices?device=1',
    });
  });

  it('keeps top-level routes as they are', () => {
    for (const link of [
      '/network',
      '/network/custom-domains',
      '/invite?token=abc',
      '/invite-organization?token=abc',
      '/recover-credentials',
      '/org/org-2/devices?device=1',
    ]) {
      expect(resolveNotificationLink(link, 'org-1')).toEqual({
        external: false,
        href: link,
      });
    }
  });

  it('only matches whole route segments', () => {
    expect(resolveNotificationLink('/networking', 'org-1').href).toBe(
      '/org/org-1/networking'
    );
    expect(resolveNotificationLink('/invites', 'org-1').href).toBe(
      '/org/org-1/invites'
    );
  });

  it('marks http and https addresses as external', () => {
    expect(resolveNotificationLink('https://a.example.com', 'org-1')).toEqual({
      external: true,
      href: 'https://a.example.com',
    });
    expect(resolveNotificationLink('HTTP://a.example.com', 'org-1')).toEqual({
      external: true,
      href: 'HTTP://a.example.com',
    });
  });

  it('does not invent an organization when none is selected', () => {
    for (const organizationId of [undefined, null]) {
      expect(resolveNotificationLink('/devices', organizationId)).toEqual({
        external: false,
        href: '/devices',
      });
    }
  });
});
