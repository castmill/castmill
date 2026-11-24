import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Socket } from 'phoenix';
import { ControlConnection, reconnectDelay } from './control-connection';

function push() {
  const callbacks: Record<string, (payload?: unknown) => void> = {};
  const result = {
    receive: vi.fn((event, callback) => {
      callbacks[event] = callback;
      return result;
    }),
    reply: (event: string, payload?: unknown) => callbacks[event]?.(payload),
  };
  return result;
}

function transport() {
  const join = push();
  const probes: ReturnType<typeof push>[] = [];
  const callbacks: Record<string, (payload?: unknown) => void> = {};
  const channel = {
    state: 'joined',
    join: vi.fn(() => join),
    push: vi.fn(() => {
      const probe = push();
      probes.push(probe);
      return probe;
    }),
    leave: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  };
  const socket = {
    channels: [channel],
    channel: vi.fn(() => channel),
    connect: vi.fn(),
    disconnect: vi.fn((callback?: () => void) => callback?.()),
    clearHeartbeats: vi.fn(),
    isConnected: vi.fn(() => true),
    onClose: vi.fn((callback) => {
      callbacks.close = callback;
      return 'close';
    }),
    onError: vi.fn((callback) => {
      callbacks.error = callback;
      return 'error';
    }),
    onMessage: vi.fn((callback) => {
      callbacks.message = callback;
      return 'message';
    }),
    off: vi.fn(),
    makeRef: vi.fn(() => `probe-${probes.length}`),
    push: vi.fn(),
  };
  return { socket, channel, join, probes, callbacks };
}

describe('independent device control connection', () => {
  const connections: ControlConnection[] = [];

  function setup() {
    const transports: ReturnType<typeof transport>[] = [];
    const owner = transport();
    owner.socket.channels = [];
    owner.socket.channel.mockImplementation(() => {
      const next = transport();
      next.socket = owner.socket;
      next.callbacks = owner.callbacks;
      next.channel.leave.mockImplementation(() => {
        owner.socket.channels = owner.socket.channels.filter(
          (channel) => channel !== next.channel
        );
      });
      owner.socket.channels.push(next.channel);
      transports.push(next);
      return next.channel;
    });
    const options = {
      createSocket: vi.fn(() => owner.socket as unknown as Socket),
      deviceId: 'device-id',
      token: 'test-token',
      onJoined: vi.fn(),
      onDisconnected: vi.fn(),
      onRecovery: vi.fn(),
      onFatal: vi.fn(),
      onError: vi.fn(),
    };
    const connection = new ControlConnection(options);
    connections.push(connection);
    connection.start();
    return { connection, options, transports };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T15:00:00Z'));
  });

  afterEach(() => {
    connections.splice(0).forEach((connection) => connection.stop());
    vi.useRealTimers();
  });

  it('replaces an open but silent authenticated socket after 90s and recovers only on acknowledgement', () => {
    const { connection, transports, options } = setup();
    const first = transports[0];
    first.join.reply('ok', { heartbeat_ack: true });
    first.probes[0].reply('ok');
    expect(connection.isHealthy()).toBe(true);

    vi.advanceTimersByTime(89_999);
    expect(transports).toHaveLength(1);
    vi.advanceTimersByTime(1001);
    expect(transports).toHaveLength(2);
    expect(first.socket.disconnect).toHaveBeenCalledOnce();
    expect(first.channel.leave).toHaveBeenCalledWith(0);
    expect(first.socket.off).toHaveBeenCalledWith([
      'close',
      'error',
      'message',
    ]);
    expect(connection.isHealthy()).toBe(false);

    const next = transports[1];
    expect(next.socket.channel).toHaveBeenCalledWith('devices:device-id', {
      token: 'test-token',
    });
    next.join.reply('ok', { heartbeat_ack: true });
    expect(options.onJoined).toHaveBeenCalledTimes(2);
    expect(options.createSocket).toHaveBeenCalledOnce();
    expect(options.onRecovery).not.toHaveBeenCalled();
    // Neither an old socket's late join nor its late heartbeat may restore health.
    first.join.reply('ok', { heartbeat_ack: true });
    first.probes[1].reply('ok');
    expect(connection.isHealthy()).toBe(false);
    next.probes[0].reply('ok');
    expect(connection.isHealthy()).toBe(true);
    expect(options.onRecovery).toHaveBeenCalledOnce();
    expect(options.onRecovery).toHaveBeenCalledWith(91_000, 1, next.channel);
    expect(options.onJoined).toHaveBeenCalledTimes(2);
  });

  it('keeps one heartbeat clock and reinitializes listeners only on fresh channels', () => {
    const { transports, options } = setup();
    const first = transports[0];
    first.join.reply('ok', { heartbeat_ack: true });
    first.probes[0].reply('ok');
    first.join.reply('ok', { heartbeat_ack: true });
    first.probes[1].reply('ok');
    expect(options.onJoined.mock.calls.map((call) => call[2])).toEqual([
      true,
      false,
    ]);
    vi.advanceTimersByTime(30_000);
    expect(first.channel.push).toHaveBeenCalledTimes(3);
    first.probes[2].reply('ok');
    expect(options.onRecovery).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('supports old servers using correlated Phoenix acknowledgements, never just an open socket', () => {
    const { connection, transports } = setup();
    const first = transports[0];
    first.join.reply('ok', {});
    expect(connection.isHealthy()).toBe(false);
    const request = first.socket.push.mock.calls[0][0];
    expect(request).toMatchObject({ topic: 'phoenix', event: 'heartbeat' });
    first.callbacks.message({
      ...request,
      event: 'phx_reply',
      ref: 'wrong',
      payload: { status: 'ok' },
    });
    expect(connection.isHealthy()).toBe(false);
    first.callbacks.message({
      ...request,
      event: 'phx_reply',
      payload: { status: 'ok' },
    });
    expect(connection.isHealthy()).toBe(true);
    vi.advanceTimersByTime(91_000);
    expect(transports).toHaveLength(2);
  });

  it('requires the custom acknowledgement when advertised, not a protocol pong', () => {
    const { connection, transports } = setup();
    const first = transports[0];
    first.join.reply('ok', { heartbeat_ack: true });
    expect(first.socket.push).not.toHaveBeenCalled();
    first.callbacks.message({
      topic: 'phoenix',
      event: 'phx_reply',
      ref: 'probe-1',
      payload: { status: 'ok' },
    });
    expect(connection.isHealthy()).toBe(false);
    vi.advanceTimersByTime(91_000);
    expect(transports).toHaveLength(2);
  });

  it('backs off repeated failed fresh attempts, capped at one minute', () => {
    const { transports } = setup();
    vi.advanceTimersByTime(91_000);
    expect(transports).toHaveLength(2);
    vi.advanceTimersByTime(19_999);
    expect(transports).toHaveLength(2);
    vi.advanceTimersByTime(2001);
    expect(transports).toHaveLength(3);
    expect([1, 2, 3, 7, 8, 100].map(reconnectDelay)).toEqual([
      1000, 2000, 4000, 60_000, 60_000, 60_000,
    ]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('nudges offline startup on online and foreground without duplicate retries', () => {
    const { transports } = setup();
    transports[0].socket.isConnected.mockReturnValue(false);
    vi.advanceTimersByTime(16_000);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1000);
    expect(transports).toHaveLength(2);
  });

  it('shortens a long backoff on online without repeatedly postponing the retry', () => {
    const { transports } = setup();
    vi.advanceTimersByTime(260_000);
    const count = transports.length;
    window.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(500);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(500);
    expect(transports).toHaveLength(count + 1);
  });

  it('does not reopen a transport if stopped while native teardown is pending', () => {
    const { connection, transports } = setup();
    let closed: (() => void) | undefined;
    transports[0].socket.disconnect.mockImplementation((callback) => {
      if (callback) closed = callback;
    });
    vi.advanceTimersByTime(91_000);
    expect(closed).toBeTypeOf('function');
    connection.stop();
    closed?.();
    expect(transports).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans timers, listeners and all owned channels when stopped, including pending retries', () => {
    const { connection, transports, options } = setup();
    const first = transports[0];
    const telemetry = { leave: vi.fn() };
    first.socket.channels.push(telemetry as unknown as typeof first.channel);
    vi.advanceTimersByTime(90_000);
    connection.stop();
    expect(vi.getTimerCount()).toBe(0);
    expect(telemetry.leave).toHaveBeenCalledWith(0);
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(300_000);
    first.join.reply('ok', { heartbeat_ack: true });
    expect(transports).toHaveLength(1);
    expect(options.onJoined).not.toHaveBeenCalled();
  });

  it('stops on authorization failure even after a previously successful join', () => {
    const { connection, transports, options } = setup();
    transports[0].join.reply('ok', { heartbeat_ack: true });
    transports[0].join.reply('error', 'unauthorized');
    expect(options.onFatal).toHaveBeenCalledWith('unauthorized');
    expect(connection.isHealthy()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports join errors and keeps trying without clearing cached credentials', () => {
    const { transports, options } = setup();
    transports[0].join.reply('error', { reason: 'temporary' });
    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onFatal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(91_000);
    expect(transports).toHaveLength(2);
  });

  it('disposes real Phoenix rejoin and heartbeat timers while protocol pongs still work', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const wires: Wire[] = [];
    class Wire {
      readyState = 0;
      bufferedAmount = 0;
      binaryType = '';
      onopen = (_event?: unknown) => {};
      onclose = (_event?: unknown) => {};
      onerror = (_event?: unknown) => {};
      onmessage = (_event?: unknown) => {};
      dropDeviceHeartbeat = false;
      emitClose = true;
      protocolPongs = 0;
      sentEvents: string[] = [];

      constructor(_url: string) {
        wires.push(this);
        setTimeout(() => {
          this.readyState = 1;
          this.onopen();
        }, 0);
      }

      send(data: string) {
        const [joinRef, ref, topic, event] = JSON.parse(data);
        this.sentEvents.push(event);
        if (
          event === 'heartbeat' &&
          topic !== 'phoenix' &&
          this.dropDeviceHeartbeat
        )
          return;
        if (event === 'heartbeat' && topic === 'phoenix') this.protocolPongs++;
        const response = event === 'phx_join' ? { heartbeat_ack: true } : {};
        setTimeout(
          () =>
            this.onmessage({
              data: JSON.stringify([
                joinRef,
                ref,
                topic,
                'phx_reply',
                { status: 'ok', response },
              ]),
            }),
          0
        );
      }

      close() {
        this.readyState = 3;
        if (this.emitClose) this.onclose({ code: 1000 });
      }
    }

    const recovery = vi.fn();
    const owner = new Socket('ws://test/socket', { transport: Wire as never });
    const connection = new ControlConnection({
      createSocket: () => owner,
      deviceId: 'device-id',
      token: 'test-token',
      onJoined: vi.fn(),
      onDisconnected: vi.fn(),
      onRecovery: recovery,
      onError: vi.fn(),
      onFatal: vi.fn(),
    });
    connections.push(connection);
    connection.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(connection.isHealthy()).toBe(true);
    vi.spyOn(owner, 'isConnected').mockReturnValueOnce(false);
    owner.push({
      topic: 'devices:device-id',
      event: 'obsolete-control-write',
      payload: {},
      ref: 'obsolete',
    });
    wires[0].dropDeviceHeartbeat = true;
    await vi.advanceTimersByTimeAsync(96_000);
    expect(wires).toHaveLength(2);
    expect(wires[0].readyState).toBe(3);
    expect(wires[0].protocolPongs).toBeGreaterThan(1);
    expect(wires[1].sentEvents).not.toContain('obsolete-control-write');
    expect(
      addListener.mock.calls.filter(([event]) => event === 'pagehide')
    ).toHaveLength(1);
    expect(
      addListener.mock.calls.filter(([event]) => event === 'pageshow')
    ).toHaveLength(1);
    expect(connection.isHealthy()).toBe(true);
    expect(recovery).toHaveBeenCalledOnce();
    wires[1].emitClose = false;
    connection.stop();
    owner.connect();
    // Let the last already-sent push timeout and bounded native-close work drain.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(wires).toHaveLength(2);
    addListener.mockRestore();
  });
});
