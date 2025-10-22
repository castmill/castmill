import {
  Component,
  createSignal,
  createEffect,
  For,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  notificationsService,
  Notification,
} from '../../services/notifications.service';
import { useI18n } from '../../i18n';
import { AiOutlineClose } from 'solid-icons/ai';
import { useNavigate } from '@solidjs/router';
import { store } from '../../store';
import './notification-dialog.scss';

interface NotificationDialogProps {
  onClose: () => void;
  onNotificationRead: (unreadCount: number) => void;
  channel?: any;
}

export const NotificationDialog: Component<NotificationDialogProps> = (
  props
) => {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const [notifications, setNotifications] = createSignal<Notification[]>([]);
  const [page, setPage] = createSignal(1);
  const [loading, setLoading] = createSignal(false);
  const [hasMore, setHasMore] = createSignal(true);
  const [unreadCount, setUnreadCount] = createSignal(0);

  let scrollContainerRef: HTMLDivElement | undefined;

  // Handle ESC key to close dialog
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  // Load initial notifications
  onMount(async () => {
    await loadNotifications();
    // Add event listener for ESC key
    document.addEventListener('keydown', handleKeyDown);
  });

  // Clean up event listener
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Listen for new notifications from WebSocket
  createEffect(() => {
    const channel = props.channel;
    if (channel) {
      channel.on('new_notification', (payload: any) => {
        if (payload.notification) {
          // Check if notification already exists to avoid duplicates
          setNotifications((prev) => {
            const exists = prev.some((n) => n.id === payload.notification.id);
            if (exists) {
              return prev;
            }
            return [payload.notification, ...prev];
          });

          if (payload.unread_count !== undefined) {
            setUnreadCount(payload.unread_count);
            props.onNotificationRead(payload.unread_count);
          }
        }
      });
    }
  });

  const loadNotifications = async () => {
    if (loading() || !hasMore()) return;

    setLoading(true);
    try {
      const result = await notificationsService.getNotifications(page(), 20);

      if (result.data.length < 20) {
        setHasMore(false);
      }

      if (page() === 1) {
        setNotifications(result.data);
      } else {
        setNotifications((prev) => [...prev, ...result.data]);
      }

      setUnreadCount(result.unread_count);
      props.onNotificationRead(result.unread_count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const scrollBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    // Load more when scrolled to bottom (within 100px)
    if (scrollBottom < 100 && !loading() && hasMore()) {
      setPage((p) => p + 1);
      loadNotifications();
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await notificationsService.markAsRead(notification.id);

        // Update local state
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );

        const newCount = Math.max(0, unreadCount() - 1);
        setUnreadCount(newCount);
        props.onNotificationRead(newCount);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate if there's a link
    if (notification.link) {
      props.onClose();
      // Check if link is a standalone route (invitation pages, auth, etc.)
      const standaloneRoutes = [
        '/invite-organization',
        '/invite',
        '/login',
        '/signup',
        '/recover-credentials',
      ];
      const isStandaloneRoute = standaloneRoutes.some((route) =>
        notification.link!.startsWith(route)
      );

      // Add organization context only to org-specific relative links
      const link =
        notification.link.startsWith('/') && !isStandaloneRoute
          ? `/org/${store.organizations.selectedId}${notification.link}`
          : notification.link;
      navigate(link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsService.markAllAsRead();

      // Update all notifications to read
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      props.onNotificationRead(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    // Return appropriate icon based on notification type
    switch (type) {
      case 'organization_invitation':
      case 'team_invitation':
        return '👥';
      case 'device_registration':
        return '📱';
      case 'device_removal':
        return '🗑️';
      case 'media_transcoded':
      case 'media_uploaded':
        return '🎬';
      case 'invitation_accepted':
        return '✅';
      case 'member_removed':
        return '👋';
      case 'device_offline_alert':
        return '⚠️';
      case 'device_online_alert':
        return '🟢';
      default:
        return '🔔';
    }
  };

  return (
    <Portal>
      <div class="notification-dialog-overlay" onClick={props.onClose}>
        <div class="notification-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="notification-dialog-header">
            <h2>{t('organizations.notifications.title')}</h2>
            <div class="notification-dialog-actions">
              <Show when={unreadCount() > 0}>
                <button
                  class="notification-mark-all-read"
                  onClick={handleMarkAllRead}
                >
                  {t('organizations.notifications.markAllRead')}
                </button>
              </Show>
              <button
                class="notification-close-btn"
                onClick={props.onClose}
                aria-label={t('common.close')}
              >
                <AiOutlineClose size={24} />
              </button>
            </div>
          </div>

          <div
            class="notification-dialog-content"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <Show
              when={notifications().length > 0}
              fallback={
                <div class="notification-empty">
                  <p>{t('organizations.notifications.empty')}</p>
                </div>
              }
            >
              <For each={notifications()}>
                {(notification) => {
                  // Translate using translation keys
                  const title = t(
                    notification.title_key,
                    notification.metadata
                  );
                  const description = notification.description_key
                    ? t(notification.description_key, notification.metadata)
                    : undefined;

                  return (
                    <div
                      class={`notification-item ${notification.read ? 'read' : 'unread'}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div class="notification-icon">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div class="notification-content">
                        <div class="notification-title">{title}</div>
                        <Show when={description}>
                          <div class="notification-description">
                            {description}
                          </div>
                        </Show>
                        <div class="notification-time">
                          {formatDate(
                            new Date(notification.inserted_at),
                            'PPp'
                          )}
                        </div>
                      </div>
                      <Show when={!notification.read}>
                        <div class="notification-unread-indicator" />
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>

            <Show when={loading()}>
              <div class="notification-loading">
                <p>{t('common.loading')}</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Portal>
  );
};
