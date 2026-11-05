import { waitForScap } from './scap-ready';
import { scheduleStartupRetry } from './startup-retry';

type AppModule = { start(root: HTMLElement): void };

export function showBootError(error: unknown): void {
  const element = document.getElementById('webos-boot');
  if (!element) return;
  element.setAttribute('role', 'alert');
  element.style.color = '#d9d9d9';
  element.style.fontFamily = 'sans-serif';
  element.style.padding = '2em';
  element.style.textAlign = 'center';
  element.textContent = error instanceof Error ? error.message : String(error);
}

/**
 * Starts the app only after SCAP is ready, because native SCAP wrappers
 * construct SCAP objects on import. Failures are shown and retried by reload.
 */
export async function bootstrap(
  loadApp: () => Promise<AppModule>
): Promise<void> {
  try {
    const root = document.getElementById('root');
    if (!(root instanceof HTMLElement)) {
      throw new Error('Root element not found.');
    }
    await waitForScap();
    (await loadApp()).start(root);
  } catch (error) {
    console.error('WebOS player boot failed', error);
    showBootError(error);
    scheduleStartupRetry();
  }
}
