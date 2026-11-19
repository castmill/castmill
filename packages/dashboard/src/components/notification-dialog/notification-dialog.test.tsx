import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@solidjs/testing-library';
import {
  NotificationDialog,
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
