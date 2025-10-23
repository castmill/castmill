import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    service = new NotificationsService('http://localhost:4000');
  });

  describe('getNotifications', () => {
    it('should fetch notifications successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: '1',
            title_key: 'test.title',
            description_key: 'test.description',
            type: 'test',
            read: false,
            inserted_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        unread_count: 1,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getNotifications();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/dashboard/notifications?page=1&page_size=20',
        {
          credentials: 'include',
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle pagination parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], unread_count: 0 }),
      });

      await service.getNotifications(2, 50);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/dashboard/notifications?page=2&page_size=50',
        {
          credentials: 'include',
        }
      );
    });

    it('should handle fetch errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(service.getNotifications()).rejects.toThrow(
        'Failed to fetch notifications: Unauthorized'
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should fetch unread count successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ count: 5 }),
      });

      const result = await service.getUnreadCount();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/dashboard/notifications/unread_count',
        {
          credentials: 'include',
        }
      );
      expect(result).toBe(5);
    });

    it('should return 0 when count is missing', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.getUnreadCount();
      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      const mockNotification = {
        id: 'notification-123',
        title_key: 'test.title',
        type: 'test',
        read: true,
        inserted_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockNotification }),
      });

      const result = await service.markAsRead('notification-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/dashboard/notifications/notification-123/read',
        {
          method: 'PATCH',
          credentials: 'include',
        }
      );
      expect(result.read).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ marked_read: 5 }),
      });

      const result = await service.markAllAsRead();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/dashboard/notifications/mark_all_read',
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      expect(result).toBe(5);
    });

    it('should return 0 when no notifications were marked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await service.markAllAsRead();
      expect(result).toBe(0);
    });
  });
});
