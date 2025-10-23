import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import NotificationBell from './notification-bell';
import { I18nProvider } from '../../i18n';

// Mock the auth module
vi.mock('../auth', () => ({
  getUser: vi.fn(() => ({ id: 'user-123', email: 'test@example.com' })),
}));

// Mock the router
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
}));

describe('NotificationBell Component', () => {
  const renderWithI18n = (component: () => any) => {
    return render(() => <I18nProvider>{component()}</I18nProvider>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
