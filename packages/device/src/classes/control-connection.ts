import { Channel, Socket } from 'phoenix';

const HEARTBEAT_MS = 30_000;
const STALE_MS = 90_000;
const ATTEMPT_TIMEOUT_MS = 15_000;

export const reconnectDelay = (attempt: number) =>
  Math.min(1000 * Math.pow(2, Math.max(attempt - 1, 0)), 60_000);

interface ConnectionOptions {
  createSocket(): Socket;
  deviceId: string;
  token: string;
  onJoined(
    channel: Channel,
    response: { orientation?: unknown },
    fresh: boolean
  ): void;
  onDisconnected(): void;
  onRecovery(durationMs: number, attempts: number, channel: Channel): void;
  onFatal(reason: string): void;
  onError(error: unknown): void;
}

// Runtime ownership APIs omitted from @types/phoenix, verified against Phoenix.
type PhoenixOwner = Socket & {
  channels: Channel[];
  sendBuffer: Array<() => void>;
  clearHeartbeats(): void;
};

/**
 * Owns only the control plane. Replacing it must never stop cached playback.
 * Phoenix still handles ordinary reconnects; this independent clock also catches
 * a transport which looks open but no longer receives replies.
 */
export class ControlConnection {
  private socket?: Socket;
  private ownedSocket?: Socket;
  private channel?: Channel;
  private generation = 0;
  private socketRefs: string[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private retry?: ReturnType<typeof setTimeout>;
  private retryAt = 0;
  private stopped = true;
  private lastAck = 0;
  private lastProbe = 0;
  private attemptStarted = 0;
  private disconnectedAt?: number;
  private attempts = 0;
  private acknowledgedHeartbeat = false;
  private legacyProbe?: string;
  private confirmed = false;

  constructor(private options: ConnectionOptions) {}

  start(): void {
    this.stop();
    this.stopped = false;
    this.lastAck = Date.now();
    this.attempts = 0;
    this.disconnectedAt = undefined;
    window.addEventListener('online', this.nudge);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.timer = setInterval(() => this.tick(), 5000);
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.generation++;
    clearInterval(this.timer);
    clearTimeout(this.retry);
    this.timer = undefined;
    this.retry = undefined;
    window.removeEventListener('online', this.nudge);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.disposeSocket();
  }

  isHealthy(): boolean {
    return !!(
      !this.stopped &&
      this.confirmed &&
      this.socket?.isConnected() &&
      this.channel?.state === 'joined' &&
      Date.now() - this.lastAck < STALE_MS
    );
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.nudge();
  };

  private nudge = () => {
    if (this.stopped) return;
    if (
      !this.isHealthy() &&
      Date.now() - this.attemptStarted >= ATTEMPT_TIMEOUT_MS
    ) {
      this.scheduleReconnect(true);
    } else {
      this.probe();
    }
  };

  private disconnected() {
    if (this.disconnectedAt === undefined) this.disconnectedAt = Date.now();
    this.confirmed = false;
    this.options.onDisconnected();
  }

  private tick() {
    if (this.stopped) return;
    if (Date.now() - this.lastAck >= STALE_MS) {
      if (this.disconnectedAt === undefined) this.disconnectedAt = this.lastAck;
      this.disconnected();
      if (Date.now() - this.attemptStarted >= ATTEMPT_TIMEOUT_MS) {
        this.scheduleReconnect();
      }
    }
    if (Date.now() - this.lastProbe >= HEARTBEAT_MS) this.probe();
  }

  private scheduleReconnect(nudge = false) {
    if (this.stopped) return;
    const delay = nudge ? 1000 : reconnectDelay(this.attempts + 1);
    const due = Date.now() + delay;
    if (this.retry) {
      if (!nudge || this.retryAt <= due) return;
      clearTimeout(this.retry);
    }
    this.retryAt = due;
    this.disconnected();
    this.retry = setTimeout(() => {
      this.retry = undefined;
      if (this.stopped) return;
      this.attempts++;
      this.connect();
    }, delay);
  }

  private connect() {
    this.attemptStarted = Date.now();
    this.confirmed = false;
    this.legacyProbe = undefined;
    const generation = ++this.generation;
    this.disposeSocket(() => {
      if (this.stopped || generation !== this.generation) return;
      this.openChannel();
    });
  }

  private openChannel() {
    try {
      // Phoenix installs anonymous pagehide/pageshow handlers in its constructor
      // without a disposal API. Reuse that owner, but replace its native transport
      // and authenticated channel on every watchdog attempt.
      const socket = this.ownedSocket ?? this.createOwner();
      this.ownedSocket = socket;
      this.socket = socket;
      (socket as PhoenixOwner).sendBuffer = [];
      const channel = (this.channel = socket.channel(
        `devices:${this.options.deviceId}`,
        {
          token: this.options.token,
        }
      ));
      const current = () =>
        !this.stopped && this.socket === socket && this.channel === channel;
      channel.onError(() => {
        if (current()) this.disconnected();
      });
      channel.onClose(() => {
        if (current()) this.disconnected();
      });
      this.socketRefs = [
        socket.onClose(() => {
          if (current()) this.disconnected();
        }),
        socket.onError(() => {
          if (current()) this.disconnected();
        }),
        socket.onMessage((raw) => {
          const message = raw as {
            ref?: string;
            topic?: string;
            event?: string;
            payload?: { status?: string };
          };
          if (
            current() &&
            !this.acknowledgedHeartbeat &&
            this.legacyProbe &&
            message.ref === this.legacyProbe &&
            message.topic === 'phoenix' &&
            message.event === 'phx_reply' &&
            message.payload?.status === 'ok' &&
            channel.state === 'joined'
          )
            this.acknowledge();
        }),
      ];
      socket.connect();
      let joined = false;
      channel
        .join()
        .receive('ok', (response = {}) => {
          if (!current()) return;
          this.acknowledgedHeartbeat = response.heartbeat_ack === true;
          // A successful authenticated join is also a round trip, but recovery
          // is reported only after the independent heartbeat has been answered.
          this.lastAck = Date.now();
          this.options.onJoined(channel, response, !joined);
          joined = true;
          this.probe();
        })
        .receive('error', (reason) => {
          if (!current()) return;
          if (reason === 'invalid_device' || reason === 'unauthorized') {
            this.stop();
            this.options.onFatal(reason);
          } else {
            this.options.onError(
              new Error(`Device channel join failed: ${JSON.stringify(reason)}`)
            );
          }
        })
        .receive('timeout', () => {
          if (current())
            this.options.onError(
              new Error('Device channel join timed out; retrying')
            );
        });
    } catch (error) {
      this.options.onError(error);
      this.scheduleReconnect();
    }
  }

  private createOwner() {
    const socket = this.options.createSocket();
    const connect = socket.connect.bind(socket);
    // Phoenix's pageshow callback can outlive disconnect(). Do not let it (or
    // a late reconnect callback) resurrect an owner after stop/disposal.
    socket.connect = (...args: Parameters<Socket['connect']>) => {
      if (!this.stopped && this.socket === socket) connect(...args);
    };
    return socket;
  }

  private probe() {
    const socket = this.socket;
    const channel = this.channel;
    if (!socket?.isConnected() || channel?.state !== 'joined') return;
    this.lastProbe = Date.now();
    channel.push('heartbeat', {}, 10_000).receive('ok', () => {
      if (
        !this.stopped &&
        this.socket === socket &&
        this.channel === channel &&
        this.acknowledgedHeartbeat &&
        socket.isConnected() &&
        channel.state === 'joined'
      ) {
        this.acknowledge();
      }
    });
    if (!this.acknowledgedHeartbeat) {
      // Older servers never reply to the custom device heartbeat. Their Phoenix
      // protocol heartbeat does reply; require that AND an authenticated channel.
      this.legacyProbe = socket.makeRef();
      socket.push({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: this.legacyProbe,
      });
    }
  }

  private acknowledge() {
    this.lastAck = Date.now();
    this.confirmed = true;
    clearTimeout(this.retry);
    this.retry = undefined;
    if (this.disconnectedAt !== undefined) {
      this.options.onRecovery(
        Math.max(0, Date.now() - this.disconnectedAt),
        this.attempts,
        this.channel!
      );
      this.disconnectedAt = undefined;
    }
    this.attempts = 0;
  }

  private disposeSocket(onClosed?: () => void) {
    const socket = this.socket ?? this.ownedSocket;
    const channel = this.channel;
    const refs = this.socketRefs;
    this.socketRefs = [];
    this.socket = undefined;
    this.channel = undefined;
    this.options.onDisconnected();
    if (socket) {
      socket.off(refs);
      const owner = socket as PhoenixOwner;
      // Some legacy transports never emit close, which Phoenix normally relies
      // on to stop its protocol heartbeat clock.
      owner.clearHeartbeats();
      for (const owned of owner.channels) owned.leave(0);
      // Old joins/commands must not flush into the replacement channel.
      // Durable error reports are replayed by DeviceErrorReporter on attach.
      owner.sendBuffer = [];
      // Leave cancels rejoin/join timers. Wait for bounded native teardown before
      // reconnecting the same owner, so old/new transports cannot overlap.
      socket.disconnect(onClosed);
    } else {
      channel?.leave(0);
      onClosed?.();
    }
  }
}
