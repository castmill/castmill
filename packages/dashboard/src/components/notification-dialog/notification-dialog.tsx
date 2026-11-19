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

  const PAGE_SIZE = 20;

  // Notifications deleted while the dialog is open (for example invitations
  // whose link was replaced). Lists loaded later must not bring them back.
  const deletedIds = new Set<string>();
  // Notifications received live; the server lists them first.
  const liveIds = new Set<string>();
  // Notifications marked read here, and when all were marked read. A response
  // to an older request must not make them unread again.
  const readIds = new Set<string>();
  let allReadAt = -1;
  // Counts live events and local reads, so an older list response does not
  // overwrite the unread count or read flags they changed.
  let listChanges = 0;
  // Bumped when the loaded pages are reloaded; older responses are ignored.
  let listVersion = 0;

  const reportUnreadCount = (count: number | undefined) => {
    if (count !== undefined) {
      setUnreadCount(count);
      props.onNotificationRead(count);
    }
  };

  // Adds a server response to a request made at `changesBefore` to the list.
  // Returns how many notifications it added, and whether it contained
  // notifications deleted meanwhile, which means its pages no longer line up
  // with the server's.
  const mergeLoaded = (
    data: Notification[],
    replace: boolean,
    changesBefore: number
  ) => {
    const loaded = data
      .filter((n) => !deletedIds.has(String(n.id)))
      .map((n) =>
        !n.read && (readIds.has(String(n.id)) || allReadAt > changesBefore)
          ? { ...n, read: true }
          : n
      );
    let added = 0;

    setNotifications((prev) => {
      if (replace) {
        const loadedIds = new Set(loaded.map((n) => String(n.id)));
        const newer = prev.filter(
          (n) => liveIds.has(String(n.id)) && !loadedIds.has(String(n.id))
        );
        added = loaded.length;
        return [...newer, ...loaded];
      }

      // Notifications received while the request was in flight are newer.
      const known = new Set(prev.map((n) => String(n.id)));
      const fresh = loaded.filter((n) => !known.has(String(n.id)));
      added = fresh.length;
      return [...prev, ...fresh];
    });

    return { added, shifted: loaded.length < data.length };
  };

  // Deleting a loaded notification shifts the server's offset-based pages, so
  // the next page would skip one. Reload everything loaded so far instead.
  const reloadLoadedPages = async () => {
    const version = ++listVersion;
    const size = page() * PAGE_SIZE;
    const changesBefore = listChanges;

    setLoading(true);
    try {
      const result = await notificationsService.getNotifications(1, size);
      if (version !== listVersion) return;

      setHasMore(result.has_more);
      const { shifted } = mergeLoaded(result.data, true, changesBefore);

      if (listChanges === changesBefore) {
        reportUnreadCount(result.unread_count);
      }
      if (shifted && hasMore()) reloadLoadedPages();
    } catch (error) {
      console.error('Failed to reload notifications:', error);
    } finally {
      if (version === listVersion) setLoading(false);
    }
  };

  // Listen for notifications from WebSocket. The channel outlives the dialog,
  // so the listeners are removed when it closes.
  createEffect(() => {
    const channel = props.channel;
    if (!channel) return;

    const newRef = channel.on('new_notification', (payload: any) => {
      const notification = payload.notification;
      if (!notification || deletedIds.has(String(notification.id))) return;

      listChanges++;
      liveIds.add(String(notification.id));
      setNotifications((prev) =>
        prev.some((n) => String(n.id) === String(notification.id))
          ? prev
          : [notification, ...prev]
      );
      reportUnreadCount(payload.unread_count);
    });

    const deletedRef = channel.on('notifications_deleted', (payload: any) => {
      listChanges++;
      for (const id of payload.ids ?? []) deletedIds.add(String(id));

      const before = notifications().length;
      setNotifications((prev) =>
        prev.filter((notification) => !deletedIds.has(String(notification.id)))
      );
      reportUnreadCount(payload.unread_count);

      if (notifications().length < before && hasMore()) reloadLoadedPages();
    });

    onCleanup(() => {
      channel.off('new_notification', newRef);
      channel.off('notifications_deleted', deletedRef);
    });
  });

  const loadNotifications = async () => {
    if (loading() || !hasMore()) return;

    const version = listVersion;
    const changesBefore = listChanges;
    let loadNextPage = false;
    setLoading(true);
    try {
      const result = await notificationsService.getNotifications(
        page(),
        PAGE_SIZE
      );
      if (version !== listVersion) return;

      setHasMore(result.has_more);
      const { added, shifted } = mergeLoaded(result.data, false, changesBefore);

      if (listChanges === changesBefore) {
        reportUnreadCount(result.unread_count);
      }
      if (shifted && hasMore()) {
        reloadLoadedPages();
      } else if (added === 0 && hasMore()) {
        // Everything on this page was filtered out, so there is nothing new
        // to scroll to: load the next page right away.
        loadNextPage = true;
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      if (version === listVersion) setLoading(false);
    }

    if (loadNextPage) {
      setPage((p) => p + 1);
      loadNotifications();
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
        listChanges++;
        readIds.add(String(notification.id));

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
      allReadAt = ++listChanges;

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
