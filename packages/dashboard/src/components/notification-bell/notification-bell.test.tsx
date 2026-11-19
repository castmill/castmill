import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import NotificationBell from './notification-bell';
import { authFetch } from '../auth';
import { I18nProvider } from '../../i18n';

// Mock the auth module
vi.mock('../auth', () => ({
  getUser: vi.fn(() => ({ id: 'user-123', email: 'test@example.com' })),
  authFetch: vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) })
  ),
}));

// Mock the router
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
}));

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    socket: undefined as any,
    organizations: { selectedId: 'org-1' },
  },
}));

vi.mock('../../store', () => ({ store: mockStore }));

describe('NotificationBell Component', () => {
  const renderWithI18n = (component: () => any) => {
    return render(() => <I18nProvider>{component()}</I18nProvider>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.socket = undefined;
  });

  it('updates the unread count when notifications are deleted', async () => {
    const handlers: Record<string, (payload: any) => void> = {};
    const push = { receive: () => push };
    mockStore.socket = {
      channel: () => ({
        join: () => push,
        on: (event: string, handler: (payload: any) => void) => {
          handlers[event] = handler;
        },
        leave: vi.fn(),
      }),
    };

    const { container } = renderWithI18n(() => <NotificationBell />);
    const badge = () => container.querySelector('.notification-badge');

    await waitFor(() => expect(handlers.notifications_deleted).toBeDefined());
    // Let the initial unread count request finish first.
    await waitFor(() => expect(authFetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    handlers.new_notification({ notification: { id: 1 }, unread_count: 2 });
    await waitFor(() => expect(badge()?.textContent).toBe('2'));

    // The dialog is closed, so only the bell can update the count.
    handlers.notifications_deleted({ ids: [1], unread_count: 1 });
    await waitFor(() => expect(badge()?.textContent).toBe('1'));

    handlers.notifications_deleted({ ids: [2], unread_count: 0 });
    await waitFor(() => expect(badge()).toBeNull());
  });

  it('should render the bell icon', () => {
    const { container } = renderWithI18n(() => <NotificationBell />);

    const bell = container.querySelector('.notification-bell');
    expect(bell).toBeTruthy();
  });

  it('should render without badge when unread count is zero', () => {
    const { container } = renderWithI18n(() => <NotificationBell />);

    const badge = container.querySelector('.notification-badge');
    expect(badge).toBeFalsy();
  });

  it('should handle click events', () => {
    const { container } = renderWithI18n(() => <NotificationBell />);

    const bell = container.querySelector('.notification-bell');
    expect(bell).toBeTruthy();

    // Should not throw when clicked
    fireEvent.click(bell!);
  });

  it('should be accessible', () => {
    const { container } = renderWithI18n(() => <NotificationBell />);

    const bell = container.querySelector('.notification-bell');
    expect(bell).toBeTruthy();

    // Check if it's focusable (for keyboard navigation)
    expect(bell).toBeInstanceOf(HTMLElement);
  });
});
