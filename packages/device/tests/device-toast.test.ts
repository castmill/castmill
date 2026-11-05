import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_TOAST_ID, showDeviceToast } from '../src/classes/device-toast';

describe('showDeviceToast', () => {
  afterEach(() => {
    document.getElementById(DEVICE_TOAST_ID)?.remove();
    vi.useRealTimers();
  });

  it('shows one reusable toast and hides it after the duration', () => {
    vi.useFakeTimers();
    showDeviceToast('Rebooting', 1000);
    showDeviceToast('Refreshing', 1000);

    const toasts = document.querySelectorAll(`#${DEVICE_TOAST_ID}`);
    expect(toasts).toHaveLength(1);
    const toast = toasts[0] as HTMLElement;
    expect(toast.textContent).toBe('Refreshing');
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.style.position).toBe('fixed');
    expect(toast.style.display).toBe('block');

    vi.advanceTimersByTime(999);
    expect(toast.style.display).toBe('block');
    vi.advanceTimersByTime(1);
    expect(toast.style.display).toBe('none');
  });

  it('restarts the hide timer when a new message replaces the current one', () => {
    vi.useFakeTimers();
    showDeviceToast('Rebooting', 1000);
    vi.advanceTimersByTime(800);
    showDeviceToast('Reboot failed', 1000);
    vi.advanceTimersByTime(800);

    const toast = document.getElementById(DEVICE_TOAST_ID)!;
    expect(toast.style.display).toBe('block');
    expect(toast.textContent).toBe('Reboot failed');
  });
});
