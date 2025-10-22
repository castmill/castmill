import { baseUrl } from '../env';

export interface Notification {
  id: string;
  title_key: string;
  description_key?: string;
  link?: string;
  type: string;
  read: boolean;
  metadata?: Record<string, any>;
  inserted_at: string;
  updated_at: string;
}

export interface NotificationsResponse {
  data: Notification[];
  unread_count: number;
}

export class NotificationsService {
  constructor(private baseUrl: string) {}

  /**
   * Fetches notifications for the current user with pagination
   */
  async getNotifications(
    page = 1,
    pageSize = 20
  ): Promise<NotificationsResponse> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/notifications?page=${page}&page_size=${pageSize}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      data: result.data || [],
      unread_count: result.unread_count || 0,
    };
  }

  /**
   * Gets the count of unread notifications
   */
  async getUnreadCount(): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/notifications/unread_count`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch unread count: ${response.statusText}`);
    }

    const result = await response.json();
    return result.count || 0;
  }

  /**
   * Marks a notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to mark notification as read: ${response.statusText}`
      );
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Marks all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/dashboard/notifications/mark_all_read`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to mark all as read: ${response.statusText}`);
    }

    const result = await response.json();
    return result.marked_read || 0;
  }
}

// Export a default instance
export const notificationsService = new NotificationsService(baseUrl);
