import {
  Component,
  createSignal,
  createEffect,
  Show,
  onCleanup,
} from 'solid-js';
import { FaRegularBell, FaSolidBell } from 'solid-icons/fa';
import { notificationsService } from '../../services/notifications.service';
import { NotificationDialog } from '../notification-dialog/notification-dialog';
import { getUser } from '../auth';
import { store } from '../../store';
import './notification-bell.scss';

interface NotificationBellProps {}

const NotificationBell: Component<NotificationBellProps> = () => {
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [showDialog, setShowDialog] = createSignal(false);
  const [channel, setChannel] = createSignal<any>(null);

  // Load initial unread count
  createEffect(async () => {
    try {
      const count = await notificationsService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  });

  // Setup WebSocket connection - wait for both socket and user to be ready
  createEffect(() => {
    const existingSocket = store.socket;
    const currentUser = getUser();

    // Only proceed when both socket and user are available
    if (!existingSocket || !currentUser?.id) {
      return;
    }

    // Join notifications channel using the existing socket
    const notifChannel = existingSocket.channel(
      `notifications:${currentUser.id}`,
      {}
    );

    notifChannel
      .join()
      .receive('ok', (resp: any) => {
        console.log('Joined notifications channel', resp);
        if (resp.unread_count !== undefined) {
          setUnreadCount(resp.unread_count);
        }
      })
      .receive('error', (resp: any) => {
        console.error('Failed to join notifications channel', resp);
      });

    // Listen for new notifications
    notifChannel.on('new_notification', (payload: any) => {
      console.log('New notification received:', payload);
      if (payload.unread_count !== undefined) {
        setUnreadCount(payload.unread_count);
      }
      // You can also show a toast notification here
    });

    setChannel(notifChannel);
  });

  // Cleanup on unmount - only leave the channel, don't disconnect the shared socket
  onCleanup(() => {
    const ch = channel();
    if (ch) {
      ch.leave();
    }
  });

  // Helper to get user ID from auth
  const getUserId = () => {
    const currentUser = getUser();
    return currentUser?.id || null;
  };

  const handleClick = () => {
    setShowDialog(!showDialog());
  };

  const handleNotificationRead = (count: number) => {
    setUnreadCount(count);
  };

  return (
    <>
      <div class="notification-bell" onClick={handleClick}>
        <Show when={unreadCount() > 0} fallback={<FaRegularBell size={20} />}>
          <div class="notification-bell-with-badge">
            <FaSolidBell size={20} />
            <span class="notification-badge">{unreadCount()}</span>
          </div>
        </Show>
      </div>

      <Show when={showDialog()}>
        <NotificationDialog
          onClose={() => setShowDialog(false)}
          onNotificationRead={handleNotificationRead}
          channel={channel()}
        />
      </Show>
    </>
  );
};

export default NotificationBell;
