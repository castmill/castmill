export const DEVICE_TOAST_ID = 'castmill-device-toast';
export const DEVICE_TOAST_DURATION_MS = 10_000;

let hideTimer: ReturnType<typeof setTimeout> | undefined;

const STYLE: Record<string, string> = {
  position: 'fixed',
  left: '50%',
  bottom: '3em',
  maxWidth: '80%',
  padding: '0.75em 1.5em',
  borderRadius: '0.5em',
  background: 'rgba(0, 0, 0, 0.85)',
  color: '#fff',
  fontFamily: 'sans-serif',
  fontSize: '1.5em',
  textAlign: 'center',
  zIndex: '2147483647',
  pointerEvents: 'none',
  webkitTransform: 'translateX(-50%)',
  transform: 'translateX(-50%)',
};

/**
 * Shows a short English status message on the device screen (device-side text
 * is not localized). Uses direct DOM updates because old WebOS engines can
 * miss reactive updates after the player has mounted. A new message replaces
 * the current one.
 */
export function showDeviceToast(
  message: string,
  durationMs = DEVICE_TOAST_DURATION_MS
): void {
  if (typeof document === 'undefined' || !document.body) return;
  let toast = document.getElementById(DEVICE_TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = DEVICE_TOAST_ID;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const style = toast.style as unknown as Record<string, string>;
    for (const key of Object.keys(STYLE)) style[key] = STYLE[key];
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(hideTimer);
  const shown = toast;
  hideTimer = setTimeout(() => {
    shown.style.display = 'none';
  }, durationMs);
}
