import type { DeviceErrorInput } from './error-reporter';

const HEARTBEAT_MS = 15_000;
const EXPECTED_EXIT_MS = 60_000;
const STORAGE_PREFIX = 'castmill.device-session:';

interface Session {
  version: 1;
  active: boolean;
  startedAt: number;
  lastSeenAt: number;
  diagnostics: string;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Session;
  return (
    session.version === 1 &&
    typeof session.active === 'boolean' &&
    Number.isFinite(session.startedAt) &&
    session.startedAt >= 0 &&
    Number.isFinite(session.lastSeenAt) &&
    session.lastSeenAt >= session.startedAt &&
    session.lastSeenAt <= 8_640_000_000_000_000 &&
    typeof session.diagnostics === 'string' &&
    session.diagnostics.length <= 768
  );
}

function diagnostics(): string {
  const templates = document.querySelectorAll('[data-component="template"]');
  const names: string[] = [];
  for (
    let index = Math.max(0, templates.length - 3);
    index < templates.length;
    index++
  ) {
    names.push(
      (templates[index].getAttribute('data-name') || 'unnamed').slice(0, 120)
    );
  }
  const images = document.querySelectorAll<HTMLElement>(
    '[data-component="image"]'
  );
  let assigned = 0;
  for (let index = 0; index < images.length; index++) {
    if (images[index].style.backgroundImage) assigned++;
  }
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    }
  ).memory?.usedJSHeapSize;
  return [
    `Mounted templates: ${names.join(', ') || 'none'}.`,
    `Image backgrounds: ${assigned}/${images.length}.`,
    typeof memory === 'number' && Number.isFinite(memory)
      ? `JS heap estimate: ${Math.round(memory / 1024 / 1024)} MiB.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Detects an interrupted session on the next boot, not a native crash cause. */
export class DeviceSessionMonitor {
  private readonly key: string;
  private readonly startedAt = Date.now();
  private expectedUntil = 0;
  private unloaded = false;
  private failed = false;
  private timer?: ReturnType<typeof setInterval>;
  private readonly onUnload = () => {
    this.unloaded = true;
    this.write(false);
  };
  private readonly onPageShow = () => {
    this.unloaded = false;
    this.write(true);
  };

  constructor(
    private storage: Pick<Storage, 'getItem' | 'setItem'>,
    deviceId: string,
    report: (input: DeviceErrorInput) => void
  ) {
    this.key = `${STORAGE_PREFIX}${deviceId}`;
    let previous: Session | undefined;
    try {
      const raw = storage.getItem(this.key);
      if (raw) {
        const value: unknown = raw.length <= 4096 ? JSON.parse(raw) : undefined;
        if (isSession(value)) previous = value;
        else
          console.warn(
            '[DeviceSessionMonitor] Discarding invalid session marker'
          );
      }
    } catch (error) {
      console.warn(
        '[DeviceSessionMonitor] Could not read session marker',
        error
      );
    }
    if (previous?.active) {
      report({
        category: 'runtime',
        code: 'player-unclean-exit',
        error: `Possible player crash: the previous session ended without a clean shutdown. An OS kill or power loss can also cause this. Started: ${new Date(previous.startedAt).toISOString()}. Last heartbeat: ${new Date(previous.lastSeenAt).toISOString()}. ${previous.diagnostics}`,
      });
    }
    this.write(true);
    if (this.failed) return;
    this.timer = setInterval(() => {
      if (!this.unloaded) this.write(Date.now() >= this.expectedUntil);
    }, HEARTBEAT_MS);
    window.addEventListener('beforeunload', this.onUnload);
    window.addEventListener('pagehide', this.onUnload);
    window.addEventListener('pageshow', this.onPageShow);
  }

  expectExit(): void {
    this.expectedUntil = Date.now() + EXPECTED_EXIT_MS;
    this.write(false);
  }

  resume(): void {
    this.expectedUntil = 0;
    this.write(true);
  }

  stop(): void {
    clearInterval(this.timer);
    window.removeEventListener('beforeunload', this.onUnload);
    window.removeEventListener('pagehide', this.onUnload);
    window.removeEventListener('pageshow', this.onPageShow);
    this.write(false);
  }

  private write(active: boolean): void {
    if (this.failed) return;
    const session: Session = {
      version: 1,
      active,
      startedAt: this.startedAt,
      lastSeenAt: Math.max(this.startedAt, Date.now()),
      diagnostics: diagnostics(),
    };
    try {
      this.storage.setItem(this.key, JSON.stringify(session));
    } catch (error) {
      this.failed = true;
      clearInterval(this.timer);
      console.warn(
        '[DeviceSessionMonitor] Crash recovery tracking could not be persisted',
        error
      );
    }
  }
}
