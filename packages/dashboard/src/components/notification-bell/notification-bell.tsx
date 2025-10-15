import { Component, createSignal, createEffect, Show, onCleanup } from 'solid-js';
import { FaRegularBell, FaSolidBell } from 'solid-icons/fa';
import { notificationsService } from '../../services/notifications.service';
import { NotificationDialog } from '../notification-dialog/notification-dialog';
import './notification-bell.scss';

interface NotificationBellProps {}

const NotificationBell: Component<NotificationBellProps> = () => {
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [showDialog, setShowDialog] = createSignal(false);
  const [socket, setSocket] = createSignal<any>(null);
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

  // Setup WebSocket connection
  createEffect(() => {
    const setupWebSocket = async () => {
      try {
        // @ts-ignore - Phoenix is loaded globally
        const { Socket } = window.Phoenix || {};
        if (!Socket) {
          console.warn('Phoenix Socket not available');
          return;
        }

        // Get authentication token from cookie
        const token = document.cookie
          .split('; ')
          .find((row) => row.startsWith('socket_token='))
          ?.split('=')[1];

        if (!token) {
          console.warn('No socket token found');
          return;
        }

        // Create socket connection
        const newSocket = new Socket('/socket', {
          params: { token },
        });

        newSocket.connect();
        setSocket(newSocket);

        // Get user ID from session/cookie or other source
        const userId = getUserId();
        if (!userId) {
          console.warn('No user ID found');
          return;
        }

        // Join notifications channel
        const notifChannel = newSocket.channel(`notifications:${userId}`, {});

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
      } catch (error) {
        console.error('Failed to setup WebSocket:', error);
      }
    };

    setupWebSocket();
  });

  // Cleanup on unmount
  onCleanup(() => {
    const ch = channel();
    const sock = socket();

    if (ch) {
      ch.leave();
    }

    if (sock) {
      sock.disconnect();
    }
  });

  // Helper to get user ID (update based on your auth implementation)
  const getUserId = () => {
    // Try to get from local storage or session
    const user = localStorage.getItem('user');
    if (user) {
      try {
        return JSON.parse(user).id;
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
    }
    return null;
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
