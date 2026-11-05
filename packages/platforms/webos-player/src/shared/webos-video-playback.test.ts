import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DECODER_LIMIT_ERROR_CODE,
  WebosDecoderBudget,
  WebosVideoPlayback,
  webosDecoderBudget,
  createWebosVideoPlaybackFactory,
} from './webos-video-playback';

class TestVideo extends EventTarget {
  readyState = 1;
  networkState = 2;
  paused = true;
  videoWidth = 1920;
  videoHeight = 1080;
  ended = false;
  src = '';
  error = null;
  position = 0;
  seekError: unknown;
  seek = vi.fn();
  play = vi.fn(() => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn(() => {
    this.readyState = 0;
  });
  getAttribute = vi.fn((name: string) =>
    name === 'src' && this.src ? this.src : null
  );
  removeAttribute = vi.fn((name: string) => {
    if (name === 'src') this.src = '';
  });

  get currentTime() {
    return this.position;
  }
  set currentTime(value: number) {
    this.seek(value);
    if (this.seekError) throw this.seekError;
    if (!this.readyState)
      throw new DOMException('HAVE_NOTHING', 'InvalidStateError');
    this.position = value;
  }

  loaded() {
    this.readyState = 1;
    this.ended = false;
    this.position = 0;
    this.dispatchEvent(new Event('loadedmetadata'));
  }
}

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('WebosVideoPlayback', () => {
  let video: TestVideo;
  let controller: WebosVideoPlayback;
  let setTimer: ReturnType<typeof vi.spyOn<typeof globalThis, 'setTimeout'>>;
  let clearTimer: ReturnType<
    typeof vi.spyOn<typeof globalThis, 'clearTimeout'>
  >;
  const report = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    setTimer = vi.spyOn(globalThis, 'setTimeout');
    clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    report.mockReset();
    webosDecoderBudget.clear();
    video = new TestVideo();
    controller = new WebosVideoPlayback(video, report);
  });

  afterEach(() => {
    try {
      controller.dispose();
      setTimer.mock.calls.forEach((args, index) => {
        if (args[1] === 15000) {
          expect(clearTimer).toHaveBeenCalledWith(
            setTimer.mock.results[index].value
          );
        }
      });
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  it('logs playback transitions and decoder events without exposing the media URL', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    video.src = 'https://media.test/video.mp4?token=secret';
    controller = new WebosVideoPlayback(video, report);

    controller.play(3000);
    await flush();
    video.dispatchEvent(new Event('waiting'));
    video.dispatchEvent(new Event('playing'));
    controller.pause();
    controller.dispose();
    video.dispatchEvent(new Event('stalled'));

    const messages = log.mock.calls.map(([message]) => String(message));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/request=play offsetMs=3000 \| .* src=remote/),
        expect.stringContaining('seeking targetSeconds=3'),
        expect.stringContaining('event=waiting'),
        expect.stringContaining('event=playing'),
        expect.stringContaining(' pause |'),
      ])
    );
    expect(messages.some((message) => message.includes('event=stalled'))).toBe(
      false
    );
    expect(messages.join(' ')).not.toContain('token=secret');
  });

  it('logs metadata timeouts and retries with a per-video identifier', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    video.readyState = 0;
    controller = new WebosVideoPlayback(video, report);

    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(15000);

    const messages = log.mock.calls.map(([message]) => String(message));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('metadata timeout retryDelayMs=30000'),
        expect.stringContaining('decoder retry scheduled delayMs=30000'),
      ])
    );
    const ids = messages.map((message) => message.match(/ #(\d+) /)?.[1]);
    expect(ids.every((id) => id === ids[0])).toBe(true);
  });

  it('timestamps load, readiness, and playback events with elapsed times', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    video.readyState = 0;
    controller = new WebosVideoPlayback(video, report);

    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(1200);
    video.loaded();
    await flush();
    video.dispatchEvent(new Event('playing'));

    const messages = log.mock.calls.map(([message]) => String(message));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^\[WebOS Video\] \d\d:\d\d:\d\d\.\d{3} #\d+ calling load reason=unready \| .* play=0ms load=0ms$/
        ),
        expect.stringMatching(
          /event=loadedmetadata dims=1920x1080 \| .* play=1200ms load=1200ms$/
        ),
        expect.stringContaining('event=playing | rs=1 ns=2 pos=0'),
      ])
    );
  });

  it('logs only playback progress transitions and stops watching after pause', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    controller = new WebosVideoPlayback(video, report);

    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    video.position = 0.5;
    await vi.advanceTimersByTimeAsync(500);
    video.position = 1;
    await vi.advanceTimersByTimeAsync(1500);
    video.position = 1.5;
    await vi.advanceTimersByTimeAsync(500);
    controller.pause();
    await vi.advanceTimersByTimeAsync(5000);

    const progress = log.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.includes('progress'));
    expect(progress).toHaveLength(1);
    expect(progress[0]).toContain('progress started');
    expect(video.load).not.toHaveBeenCalled();
  });

  it('reloads a stalled video once and resumes at the expected position', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    controller = new WebosVideoPlayback(video, report);

    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    video.position = 0.2;
    await vi.advanceTimersByTimeAsync(2500);

    expect(video.load).toHaveBeenCalledTimes(1);
    video.loaded();
    await flush();

    const messages = log.mock.calls.map(([message]) => String(message));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/no progress forMs=2000 .*\| .* pos=0\.2/),
        expect.stringContaining('recovering stalled playback offsetMs=2200'),
        expect.stringContaining('calling load reason=stalled'),
      ])
    );
    expect(video.position).toBeCloseTo(2.2);
    expect(video.paused).toBe(false);

    // A second stall in the same slot is only logged.
    await vi.advanceTimersByTimeAsync(2500);
    expect(video.load).toHaveBeenCalledTimes(1);
  });

  it('recovers stalls without logging enabled', async () => {
    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(video.load).toHaveBeenCalledTimes(1);
  });

  it('allows a new stall recovery after the next play request', async () => {
    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    video.loaded();
    await flush();
    controller.pause();

    controller.play(5000);
    await flush();
    await vi.advanceTimersByTimeAsync(2500);
    expect(video.load).toHaveBeenCalledTimes(2);
  });

  it('does not reload a video that stops at its end', async () => {
    Object.defineProperty(video, 'duration', { value: 12, configurable: true });
    controller.play(11700);
    await flush();
    await vi.advanceTimersByTimeAsync(2500);
    expect(video.load).not.toHaveBeenCalled();
  });

  it('reports a video that never advances after play', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    controller = new WebosVideoPlayback(video, report);

    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(2000);

    const messages = log.mock.calls.map(([message]) => String(message));
    expect(messages.some((m) => m.includes('progress started'))).toBe(false);
    expect(messages.some((m) => m.includes('no progress forMs=2000'))).toBe(
      true
    );
  });

  it('does not log repeated near-identical timeline seeks', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    controller = new WebosVideoPlayback(video, report);

    controller.seek(490);
    controller.seek(105);
    controller.seek(105);
    controller.seek(106);
    controller.play(106);
    await flush();

    const requests = log.mock.calls
      .map(([message]) => String(message))
      .filter((message) => message.includes('request='))
      .map((message) => message.match(/request=\w+ offsetMs=\d+/)?.[0]);
    expect(requests).toEqual([
      'request=seek offsetMs=490',
      'request=seek offsetMs=105',
      'request=play offsetMs=106',
    ]);
  });

  it('logs DOM attachment, visibility, and layer state for playing videos', async () => {
    controller.dispose();
    vi.stubEnv('VITE_LOGGING', 'true');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const layer = document.createElement('div');
    layer.dataset.layer = 'Clip B';
    layer.style.zIndex = '1000';
    layer.style.visibility = 'hidden';
    const element = document.createElement('video');
    Object.defineProperty(element, 'readyState', { value: 4 });
    element.play = vi.fn(() => Promise.resolve());
    element.pause = vi.fn();
    element.load = vi.fn();
    layer.appendChild(element);
    document.body.appendChild(layer);
    const playback = new WebosVideoPlayback(element, report);

    try {
      element.dispatchEvent(new Event('playing'));
      layer.remove();
      element.dispatchEvent(new Event('playing'));
    } finally {
      playback.dispose();
    }

    const messages = log.mock.calls.map(([message]) => String(message));
    const [attached, detached] = messages.filter((message) =>
      message.includes('event=playing')
    );
    expect(attached).not.toContain('detached');
    expect(attached).toMatch(
      /hiddenBy=div\[layer=Clip B\]\(display=block,visibility=hidden,opacity=[^,]*,z=1000\)/
    );
    expect(attached).toContain('videos=0/1');
    expect(detached).toContain('detached');
  });

  it('coalesces pre-show seek and play without a duplicate seek', async () => {
    controller.seek(2000);
    controller.play(3000);
    await flush();
    expect(video.seek.mock.calls).toEqual([[3]]);
    expect(video.play).toHaveBeenCalledOnce();
    expect(video.load).not.toHaveBeenCalled();
  });

  it('plays at least five cycles, reloading on each restart', async () => {
    controller.play(0);
    await flush();
    for (let i = 1; i < 5; i++) {
      controller.pause();
      video.position = 12;
      video.ended = true;
      video.readyState = 0;
      controller.seek(0);
      controller.play(0);
      await flush();
      expect(video.play).toHaveBeenCalledTimes(i);
      video.loaded();
      await flush();
      expect(video.play).toHaveBeenCalledTimes(i + 1);
    }
    expect(video.load).toHaveBeenCalledTimes(4);
    expect(video.seek).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('does not reload a visible video when the slot ends right after its timeline wraps', async () => {
    video.readyState = 4;
    controller.play(0);
    await flush();
    video.position = 19.6;

    controller.play(35);
    await vi.advanceTimersByTimeAsync(60);
    controller.pause();
    await vi.advanceTimersByTimeAsync(1000);

    expect(video.load).not.toHaveBeenCalled();
    expect(video.position).toBe(19.6);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it('does not seek a visible video back to its start when the slot ends right after a late timeline wrap', async () => {
    video.readyState = 4;
    controller.play(0);
    await flush();
    video.position = 19.3;

    controller.play(60);
    await vi.advanceTimersByTimeAsync(20);
    controller.pause();
    await vi.advanceTimersByTimeAsync(1000);

    expect(video.seek).not.toHaveBeenCalled();
    expect(video.position).toBe(19.3);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it('reloads a reused video immediately even after WebOS reloaded it', async () => {
    video.readyState = 4;
    controller.play(0);
    await flush();
    controller.pause();
    video.position = 0;
    video.dispatchEvent(new Event('loadstart'));

    controller.seek(0);
    controller.play(0);
    await flush();

    // A WebOS self-reload after detaching can leave playback stuck at zero.
    expect(video.load).toHaveBeenCalledOnce();
    video.loaded();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });

  it('restarts a looping visible video after the deferral', async () => {
    video.readyState = 4;
    controller.play(0);
    await flush();
    video.position = 19.6;

    controller.play(35);
    await vi.advanceTimersByTimeAsync(249);
    expect(video.load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(video.load).toHaveBeenCalledOnce();
    video.loaded();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });

  it('preserves paused nonzero seeks after metadata arrives', async () => {
    video.readyState = 0;
    controller.seek(4500);
    await flush();
    video.loaded();
    await flush();
    expect(video.currentTime).toBe(4.5);
    expect(video.play).not.toHaveBeenCalled();
  });

  it('does not reload an unready paused video already at zero during the next video', async () => {
    controller.play(0);
    await flush();
    controller.pause();
    video.readyState = 0;
    video.position = 0;

    controller.seek(0);
    await flush();
    expect(video.load).not.toHaveBeenCalled();
    expect(video.play).toHaveBeenCalledOnce();

    controller.play(0);
    await flush();
    expect(video.load).toHaveBeenCalledOnce();
    video.loaded();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(report).not.toHaveBeenCalled();
  });

  it.each(['pause', 'dispose'] as const)(
    'cancels pending work on %s',
    async (method) => {
      video.readyState = 0;
      controller.play(4000);
      await flush();
      controller[method]();
      video.loaded();
      await flush();
      expect(video.seek).not.toHaveBeenCalled();
      expect(video.play).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
    }
  );

  it('cancels a request before metadata can resume its continuation', async () => {
    video.readyState = 0;
    controller.play(4000);
    await flush();
    video.loaded();
    controller.pause();
    await flush();
    expect(video.seek).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('supersedes pending play with a seek and reuses the pending load', async () => {
    video.readyState = 0;
    controller.play(1000);
    await flush();
    controller.seek(6000);
    await flush();
    expect(video.load).toHaveBeenCalledOnce();
    video.loaded();
    await flush();
    expect(video.seek.mock.calls).toEqual([[6]]);
    expect(video.play).not.toHaveBeenCalled();
  });

  it('supersedes pending play with the latest play offset', async () => {
    video.readyState = 0;
    controller.play(1000);
    await flush();
    controller.play(3000);
    await flush();
    video.loaded();
    await flush();
    expect(video.load).toHaveBeenCalledOnce();
    expect(video.seek.mock.calls).toEqual([[3]]);
    expect(video.play).toHaveBeenCalledOnce();
  });

  it('recovers a misleading readyState with one reload', async () => {
    video.position = 12;
    video.seekError = new DOMException('HAVE_NOTHING', 'InvalidStateError');
    controller.play(0);
    await flush();
    expect(video.load).toHaveBeenCalledOnce();
    video.seekError = undefined;
    video.loaded();
    await flush();
    expect(video.play).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a second seek failure instead of retrying forever', async () => {
    video.seekError = { code: 11 };
    controller.play(3000);
    await flush();
    video.loaded();
    await flush();
    expect(video.load).toHaveBeenCalledOnce();
    expect(video.play).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledOnce();
  });

  it('does not retry unrelated seek errors', async () => {
    video.seekError = new Error('Unexpected seek failure');
    controller.play(2000);
    await flush();
    expect(video.load).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledOnce();
  });

  it.each([NaN, -1, Infinity])('reports invalid offset %s', async (offset) => {
    controller.play(offset);
    await flush();
    expect(report).toHaveBeenCalledOnce();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('times out and removes its event listeners', async () => {
    const remove = vi.spyOn(video, 'removeEventListener');
    video.readyState = 0;
    controller.play(0);
    await flush();
    video.dispatchEvent(new Event('loadedmetadata'));
    await vi.advanceTimersByTimeAsync(15000);
    expect(report).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledTimes(4);
    video.loaded();
    await flush();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('accepts another ready event when loadedmetadata is not emitted', async () => {
    video.readyState = 0;
    controller.play(2000);
    await flush();
    video.readyState = 2;
    video.dispatchEvent(new Event('loadeddata'));
    await flush();
    expect(video.currentTime).toBe(2);
    expect(video.play).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it('uses readyState at the deadline if WebOS omitted metadata events', async () => {
    video.readyState = 0;
    controller.play(2000);
    await flush();
    video.readyState = 1;
    await vi.advanceTimersByTimeAsync(15000);
    expect(video.play).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it('backs off a timed-out decoder while other videos continue playing', async () => {
    video.readyState = 0;
    controller.play(0);
    await flush();
    const secondVideo = new TestVideo();
    const second = new WebosVideoPlayback(secondVideo, report);
    try {
      await vi.advanceTimersByTimeAsync(15000);
      expect(report).toHaveBeenCalledOnce();
      controller.play(0);
      second.play(3000);
      await flush();
      expect(video.load).toHaveBeenCalledOnce();
      expect(secondVideo.play).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(29999);
      expect(video.load).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      await flush();
      expect(video.load).toHaveBeenCalledTimes(2);
      video.loaded();
      await flush();
      expect(video.play).toHaveBeenCalledOnce();
    } finally {
      second.dispose();
    }
  });

  it('cancels a scheduled decoder retry when paused', async () => {
    video.readyState = 0;
    controller.play(0);
    await flush();
    await vi.advanceTimersByTimeAsync(15000);
    controller.pause();
    await vi.advanceTimersByTimeAsync(30000);
    expect(video.load).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledOnce();
  });

  it('reports a media load error without an unhandled rejection', async () => {
    video.readyState = 0;
    controller.play(0);
    await flush();
    video.dispatchEvent(new Event('error'));
    await flush();
    expect(report).toHaveBeenCalledOnce();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('refreshes a missing native file and resumes playback at its previous offset', async () => {
    controller.dispose();
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    const replacement = `http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`;
    const refresh = vi.fn().mockResolvedValue(replacement);
    controller = new WebosVideoPlayback(video, report, refresh);
    controller.play(4000);
    await flush();
    video.dispatchEvent(new Event('error'));
    await flush();
    expect(refresh).toHaveBeenCalledOnce();
    expect(video.src).toBe(replacement);
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(video.currentTime).toBe(4);
  });

  it.each([undefined, new Error('Download failed')])(
    'reports a failed native refresh without restarting playback (%s)',
    async (failure) => {
      controller.dispose();
      video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
      const refresh = failure
        ? vi.fn().mockRejectedValue(failure)
        : vi.fn().mockResolvedValue(undefined);
      controller = new WebosVideoPlayback(video, report, refresh);
      controller.play(4000);
      await flush();
      video.dispatchEvent(new Event('error'));
      await flush();
      expect(refresh).toHaveBeenCalledOnce();
      expect(video.play).toHaveBeenCalledOnce();
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'media-load',
          code: 'video-load-failed',
        })
      );
      video.dispatchEvent(new Event('error'));
      await flush();
      expect(refresh).toHaveBeenCalledOnce();
    }
  );

  it.each(['blob:video', 'https://media.test/movie.mp4'])(
    'does not redownload non-native media on decoder errors (%s)',
    async (src) => {
      controller.dispose();
      video.src = src;
      const refresh = vi.fn();
      controller = new WebosVideoPlayback(video, report, refresh);
      expect(await controller.recoverMedia()).toBeUndefined();
      controller.play(1000);
      await flush();
      video.dispatchEvent(new Event('error'));
      await flush();
      expect(refresh).not.toHaveBeenCalled();
      expect(report).toHaveBeenCalledOnce();
    }
  );

  it('supports storage-specific native recognition through the shared factory', async () => {
    video.src = 'file://custom-cache/movie.mp4';
    const refresh = vi.fn().mockResolvedValue('file://custom-cache/new.mp4');
    const isNativeUrl = vi.fn((url: string) =>
      url.startsWith('file://custom-cache/')
    );
    const factory = createWebosVideoPlaybackFactory({
      isNativeUrl,
      budget: new WebosDecoderBudget(2),
    });
    const playback = factory(video as HTMLVideoElement, {
      refreshMedia: refresh,
    });
    expect(await playback.recoverMedia?.()).toBe('file://custom-cache/new.mp4');
    expect(isNativeUrl).toHaveBeenCalledWith(video.src);
    playback.dispose();
  });

  it('does not restart a failed video after it is paused during recovery', async () => {
    controller.dispose();
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    let resolve!: (url: string) => void;
    const refresh = vi.fn().mockReturnValue(
      new Promise<string>((done) => {
        resolve = done;
      })
    );
    controller = new WebosVideoPlayback(video, report, refresh);
    controller.play(4000);
    await flush();
    video.dispatchEvent(new Event('error'));
    controller.pause();
    resolve(`http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`);
    await flush();
    expect(video.play).toHaveBeenCalledOnce();
  });

  it('ignores a late decoder error after playback is paused', async () => {
    controller.dispose();
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    const refresh = vi
      .fn()
      .mockResolvedValue(
        `http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`
      );
    controller = new WebosVideoPlayback(video, report, refresh);
    controller.play(4000);
    await flush();
    controller.pause();
    video.dispatchEvent(new Event('error'));
    await flush();
    expect(refresh).not.toHaveBeenCalled();
    expect(video.play).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it('does not turn a paused seek into playback after a decoder error', async () => {
    controller.dispose();
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    const refresh = vi
      .fn()
      .mockResolvedValue(
        `http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`
      );
    controller = new WebosVideoPlayback(video, report, refresh);
    controller.play(4000);
    await flush();
    controller.pause();
    controller.seek(6000);
    await flush();
    video.dispatchEvent(new Event('error'));
    await flush();
    expect(refresh).not.toHaveBeenCalled();
    expect(video.play).toHaveBeenCalledOnce();
    expect(report).not.toHaveBeenCalled();
  });

  it('ignores a failed recovery after playback is paused', async () => {
    controller.dispose();
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    let reject!: (error: Error) => void;
    const refresh = vi.fn().mockReturnValue(
      new Promise<string>((_resolve, fail) => {
        reject = fail;
      })
    );
    controller = new WebosVideoPlayback(video, report, refresh);
    controller.play(4000);
    await flush();
    video.dispatchEvent(new Event('error'));
    controller.pause();
    reject(new Error('Download failed'));
    await flush();
    expect(report).not.toHaveBeenCalled();
  });

  it('reports synchronous load failures', async () => {
    video.readyState = 0;
    video.load.mockImplementation(() => {
      throw new Error('Load failed');
    });
    controller.play(0);
    await flush();
    expect(report).toHaveBeenCalledOnce();
  });

  it('reports rejected play promises using the shared error reporter', async () => {
    video.play.mockRejectedValue(new Error('Autoplay denied'));
    controller.play(0);
    await flush();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'video-play-rejected' })
    );
  });

  it('ignores all requests after disposal', async () => {
    controller.dispose();
    controller.play(0);
    controller.seek(2000);
    controller.dispose();
    await flush();
    expect(video.load).not.toHaveBeenCalled();
    expect(video.seek).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('keeps state separate between video elements', async () => {
    const secondVideo = new TestVideo();
    const second = new WebosVideoPlayback(secondVideo, report);
    controller.play(0);
    second.play(2000);
    await flush();
    controller.pause();
    expect(secondVideo.currentTime).toBe(2);
    expect(secondVideo.play).toHaveBeenCalledOnce();
    second.dispose();
  });

  describe('decoder budget', () => {
    const NATIVE = 'file:///media/castmill/video.mp4';

    const playedController = async (
      budget: WebosDecoderBudget,
      src = NATIVE
    ) => {
      const element = new TestVideo();
      element.src = src;
      element.readyState = 4;
      const playback = new WebosVideoPlayback(
        element,
        report,
        undefined,
        budget
      );
      playback.play(0);
      await flush();
      return { element, playback };
    };

    it('releases a played video seeked after its layer was detached', async () => {
      const budget = new WebosDecoderBudget();
      const { element, playback } = await playedController(budget);
      expect(budget.size).toBe(1);
      playback.pause();
      vi.spyOn(playback, 'isAttached').mockReturnValue(false);

      playback.seek(0);
      await flush();

      expect(element.removeAttribute).toHaveBeenCalledWith('src');
      expect(element.src).toBe('');
      expect(element.load).toHaveBeenCalledOnce();
      expect(budget.size).toBe(0);

      // Further detached seeks are no-ops.
      playback.seek(0);
      await flush();
      expect(element.load).toHaveBeenCalledOnce();
      playback.dispose();
    });

    it('restores the source and reloads when a released video plays again', async () => {
      vi.stubEnv('VITE_LOGGING', 'true');
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const budget = new WebosDecoderBudget();
      const { element, playback } = await playedController(budget);
      playback.pause();
      const attached = vi.spyOn(playback, 'isAttached').mockReturnValue(false);
      playback.seek(0);
      await flush();
      attached.mockReturnValue(true);

      playback.play(0);
      await flush();
      expect(element.src).toBe(NATIVE);
      // The src assignment starts loading; no redundant load() call.
      expect(element.load).toHaveBeenCalledOnce();
      expect(element.play).toHaveBeenCalledOnce();
      element.loaded();
      await flush();
      expect(element.play).toHaveBeenCalledTimes(2);
      expect(budget.size).toBe(1);
      const messages = log.mock.calls.map(([message]) => String(message));
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /released decoder reason=detached .*src=released/
          ),
          expect.stringContaining('calling load reason=released'),
        ])
      );
      expect(report).not.toHaveBeenCalled();
      playback.dispose();
    });

    it('does not release a detached video that has not played yet', async () => {
      const budget = new WebosDecoderBudget();
      const element = new TestVideo();
      element.src = NATIVE;
      const playback = new WebosVideoPlayback(
        element,
        report,
        undefined,
        budget
      );
      vi.spyOn(playback, 'isAttached').mockReturnValue(false);
      playback.seek(400);
      await flush();
      expect(element.removeAttribute).not.toHaveBeenCalled();
      expect(element.currentTime).toBe(0.4);
      playback.dispose();
    });

    it('keeps at most two sources, releasing the least recent paused video first', async () => {
      const budget = new WebosDecoderBudget();
      const first = await playedController(budget);
      first.playback.pause();
      const second = await playedController(budget);
      second.playback.pause();
      const third = await playedController(budget);

      expect(first.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(second.element.removeAttribute).not.toHaveBeenCalled();
      expect(third.element.play).toHaveBeenCalledOnce();
      expect(budget.size).toBe(2);
      [first, second, third].forEach(({ playback }) => playback.dispose());
    });

    it('prefers releasing detached videos and never releases playing ones', async () => {
      const budget = new WebosDecoderBudget();
      const playing = await playedController(budget);
      const detached = await playedController(budget);
      detached.playback.pause();
      vi.spyOn(detached.playback, 'isAttached').mockReturnValue(false);
      const visible = await playedController(budget);
      visible.playback.pause();
      await playedController(budget).then(({ playback, element }) => {
        expect(element.play).toHaveBeenCalledOnce();
        playback.dispose();
      });

      expect(playing.element.removeAttribute).not.toHaveBeenCalled();
      expect(detached.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(visible.element.removeAttribute).toHaveBeenCalledWith('src');
      [playing, detached, visible].forEach(({ playback }) =>
        playback.dispose()
      );
    });

    it('frees the source when disposed', async () => {
      const budget = new WebosDecoderBudget();
      const { element, playback } = await playedController(budget);
      playback.dispose();
      expect(element.removeAttribute).toHaveBeenCalledWith('src');
      expect(budget.size).toBe(0);
    });

    const newController = (budget: WebosDecoderBudget, area = 0) => {
      const element = new TestVideo();
      element.readyState = 0;
      const playback = new WebosVideoPlayback(
        element,
        report,
        undefined,
        budget
      );
      vi.spyOn(playback, 'displayArea').mockReturnValue(area);
      let loadable = false;
      const whenLoadable = playback.whenLoadable().then(() => {
        loadable = true;
      });
      return {
        element,
        playback,
        whenLoadable,
        isLoadable: () => loadable,
      };
    };

    it('lets a new video load at once by releasing a paused video', async () => {
      const budget = new WebosDecoderBudget();
      const playing = await playedController(budget);
      const paused = await playedController(budget);
      paused.playback.pause();

      const fresh = newController(budget);
      await fresh.whenLoadable;

      expect(paused.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(playing.element.removeAttribute).not.toHaveBeenCalled();
      expect(budget.size).toBe(2);
      [playing, paused, fresh].forEach(({ playback }) => playback.dispose());
    });

    it('delays loading a new video until a playing video pauses', async () => {
      const budget = new WebosDecoderBudget();
      const first = await playedController(budget);
      const second = await playedController(budget);

      const fresh = newController(budget);
      await flush();
      expect(fresh.isLoadable()).toBe(false);
      expect(budget.size).toBe(2);
      expect(budget.waiting).toBe(1);

      second.playback.pause();
      await flush();
      expect(fresh.isLoadable()).toBe(true);
      expect(second.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(first.element.removeAttribute).not.toHaveBeenCalled();
      expect(budget.size).toBe(2);
      expect(budget.waiting).toBe(0);
      [first, second, fresh].forEach(({ playback }) => playback.dispose());
    });

    it('keeps a loading new video until its metadata arrives', async () => {
      const budget = new WebosDecoderBudget();
      const playing = await playedController(budget);
      const loading = newController(budget);
      await loading.whenLoadable;
      loading.element.src = NATIVE;

      const next = await playedController(budget);
      expect(next.element.play).not.toHaveBeenCalled();
      expect(loading.element.removeAttribute).not.toHaveBeenCalled();

      loading.element.loaded();
      await flush();
      // Readiness handlers of the widget run before the decoder is handed on.
      expect(loading.element.removeAttribute).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(0);
      expect(loading.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(next.element.play).toHaveBeenCalledOnce();
      [playing, loading, next].forEach(({ playback }) => playback.dispose());
    });

    it('stops protecting a new video whose metadata never arrives', async () => {
      const budget = new WebosDecoderBudget();
      const playing = await playedController(budget);
      const loading = newController(budget);
      await loading.whenLoadable;
      loading.element.src = NATIVE;
      const next = await playedController(budget);
      expect(next.element.play).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(15000);
      await vi.advanceTimersByTimeAsync(1);
      expect(next.element.play).toHaveBeenCalledOnce();
      [playing, loading, next].forEach(({ playback }) => playback.dispose());
    });

    it('queues a play request beyond the budget and plays it on handoff', async () => {
      const budget = new WebosDecoderBudget();
      const first = await playedController(budget);
      const second = await playedController(budget);
      const third = await playedController(budget);

      expect(third.element.play).not.toHaveBeenCalled();
      expect(budget.size).toBe(2);
      expect(first.element.removeAttribute).not.toHaveBeenCalled();
      expect(second.element.removeAttribute).not.toHaveBeenCalled();

      // A paused waiter gives up its place in the queue.
      third.playback.pause();
      expect(budget.waiting).toBe(0);
      third.playback.play(500);
      await flush();
      expect(budget.waiting).toBe(1);

      first.playback.pause();
      await flush();
      expect(first.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(third.element.play).toHaveBeenCalledOnce();
      expect(third.element.currentTime).toBe(0.5);
      [first, second, third].forEach(({ playback }) => playback.dispose());
    });

    it('serves play requests first, then the largest waiting video', async () => {
      const budget = new WebosDecoderBudget(1);
      const current = await playedController(budget);
      const small = newController(budget, 100);
      const large = newController(budget, 1000);
      const player = await playedController(budget);
      expect(budget.waiting).toBe(3);

      current.playback.pause();
      await flush();
      expect(player.element.play).toHaveBeenCalledOnce();
      expect(large.isLoadable()).toBe(false);

      player.playback.pause();
      await flush();
      expect(large.isLoadable()).toBe(true);
      expect(small.isLoadable()).toBe(false);
      [current, small, large, player].forEach(({ playback }) =>
        playback.dispose()
      );
    });

    it('releases a loaded, unrequested video only for a play request', async () => {
      const budget = new WebosDecoderBudget(1);
      const loaded = newController(budget);
      await loaded.whenLoadable;
      loaded.element.src = NATIVE;
      const preload = newController(budget);
      loaded.element.loaded();
      await vi.advanceTimersByTimeAsync(1);
      expect(loaded.element.removeAttribute).not.toHaveBeenCalled();
      expect(preload.isLoadable()).toBe(false);

      const player = await playedController(budget);
      expect(loaded.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(player.element.play).toHaveBeenCalledOnce();
      expect(preload.isLoadable()).toBe(false);
      [loaded, preload, player].forEach(({ playback }) => playback.dispose());
    });

    const blockedController = (budget: WebosDecoderBudget, src?: string) => {
      const element = new TestVideo();
      element.readyState = 0;
      if (src) element.src = src;
      const setBlocked = vi.fn();
      const playback = new WebosVideoPlayback(
        element,
        report,
        undefined,
        budget,
        setBlocked
      );
      return { element, playback, setBlocked };
    };

    it('marks a waiting video as blocked until it gets a decoder', async () => {
      const budget = new WebosDecoderBudget(1);
      const playing = await playedController(budget);
      const { playback, setBlocked } = blockedController(budget);
      const loadable = playback.whenLoadable();

      expect(setBlocked).toHaveBeenCalledOnce();
      const [{ category, code, error }] = setBlocked.mock.calls[0];
      expect(category).toBe('playback');
      expect(code).toBe(DECODER_LIMIT_ERROR_CODE);
      expect(error.message).toBe(
        'Video playback blocked: the player tried to play more than 1 video at the same time, the maximum this device supports. The blocked video was skipped, or, when no other playlist item could play, delayed until another video finished. Reduce the number of videos playing simultaneously (e.g. video zones in a layout) to avoid this.'
      );

      playing.playback.pause();
      await loadable;
      expect(setBlocked).toHaveBeenCalledTimes(2);
      expect(setBlocked).toHaveBeenLastCalledWith();
      [playing.playback, playback].forEach((item) => item.dispose());
    });

    it('clears the block when a waiting video is paused or disposed', async () => {
      const budget = new WebosDecoderBudget();
      const first = await playedController(budget);
      const second = await playedController(budget);
      const { playback, setBlocked } = blockedController(budget, NATIVE);

      playback.play(0);
      await flush();
      expect(setBlocked).toHaveBeenLastCalledWith(
        expect.objectContaining({ code: DECODER_LIMIT_ERROR_CODE })
      );
      expect(setBlocked.mock.calls[0][0].error.message).toContain(
        'more than 2 videos'
      );
      playback.pause();
      expect(setBlocked).toHaveBeenLastCalledWith();

      playback.play(0);
      await flush();
      expect(setBlocked).toHaveBeenCalledTimes(3);
      playback.dispose();
      expect(setBlocked).toHaveBeenCalledTimes(4);
      expect(setBlocked).toHaveBeenLastCalledWith();
      [first, second].forEach((item) => item.playback.dispose());
    });

    it('resolves a pending load when disposed while waiting', async () => {
      const budget = new WebosDecoderBudget(1);
      const playing = await playedController(budget);
      const waiting = newController(budget);
      waiting.playback.dispose();
      await flush();
      expect(waiting.isLoadable()).toBe(true);
      expect(budget.waiting).toBe(0);
      playing.playback.dispose();
    });

    it('leaves reporting a block to the playlist and keeps the others playing', async () => {
      const budget = new WebosDecoderBudget(2);
      const first = await playedController(budget);
      const second = await playedController(budget);
      const { playback, setBlocked } = blockedController(budget, NATIVE);
      playback.play(0);
      await flush();
      report.mockClear();
      [first, second].forEach(({ element }) => element.pause.mockClear());

      await vi.advanceTimersByTimeAsync(1000);

      expect(setBlocked).toHaveBeenCalledOnce();
      expect(report).not.toHaveBeenCalled();
      expect(first.element.pause).not.toHaveBeenCalled();
      expect(second.element.pause).not.toHaveBeenCalled();

      // Playback continues once another video finishes.
      first.playback.pause();
      await flush();
      expect(setBlocked).toHaveBeenLastCalledWith();
      [first, second].forEach((item) => item.playback.dispose());
      playback.dispose();
    });

    it('logs waiting for and receiving a decoder', async () => {
      vi.stubEnv('VITE_LOGGING', 'true');
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const budget = new WebosDecoderBudget(1);
      const playing = await playedController(budget);
      const waiting = newController(budget);
      playing.playback.pause();
      await flush();
      const messages = log.mock.calls.map(([message]) => String(message));
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.stringContaining('waiting for decoder decoders=1 waiting=1'),
          expect.stringContaining('decoder granted'),
        ])
      );
      [playing, waiting].forEach(({ playback }) => playback.dispose());
    });

    it('does not grant a decoder to a waiting video whose layer was removed', async () => {
      const budget = new WebosDecoderBudget(1);
      const playing = await playedController(budget);
      const parked = newController(budget);
      const attached = vi
        .spyOn(parked.playback, 'isAttached')
        .mockReturnValue(false);

      playing.playback.pause();
      await flush();
      await vi.advanceTimersByTimeAsync(5000);
      expect(parked.isLoadable()).toBe(false);
      expect(playing.element.removeAttribute).not.toHaveBeenCalled();
      expect(budget.waiting).toBe(1);

      // Shown again: the video gets the decoder without any other event.
      attached.mockReturnValue(true);
      await vi.advanceTimersByTimeAsync(1000);
      expect(parked.isLoadable()).toBe(true);
      expect(playing.element.removeAttribute).toHaveBeenCalledWith('src');
      [playing, parked].forEach(({ playback }) => playback.dispose());
    });

    it('hands a decoder on only after the pausing caller has finished', async () => {
      const budget = new WebosDecoderBudget(1);
      const playing = await playedController(budget);
      const waiting = newController(budget);
      const attached = vi.spyOn(waiting.playback, 'isAttached');

      // The renderer pauses a layer's videos before removing the layer.
      playing.playback.pause();
      expect(waiting.isLoadable()).toBe(false);
      attached.mockReturnValue(false);
      await flush();

      expect(waiting.isLoadable()).toBe(false);
      expect(budget.size).toBe(1);
      [playing, waiting].forEach(({ playback }) => playback.dispose());
    });

    it('releases a preloaded video of a removed layer for another preload', async () => {
      const budget = new WebosDecoderBudget(1);
      const preloaded = newController(budget);
      await preloaded.whenLoadable;
      preloaded.element.src = NATIVE;
      preloaded.element.loaded();
      await vi.advanceTimersByTimeAsync(1);
      vi.spyOn(preloaded.playback, 'isAttached').mockReturnValue(false);

      const next = newController(budget);
      await next.whenLoadable;

      expect(preloaded.element.removeAttribute).toHaveBeenCalledWith('src');
      expect(next.isLoadable()).toBe(true);
      [preloaded, next].forEach(({ playback }) => playback.dispose());
    });

    it('stops checking for parked videos once the budget is cleared', async () => {
      const budget = new WebosDecoderBudget(1);
      const playing = await playedController(budget);
      const parked = newController(budget);
      vi.spyOn(parked.playback, 'isAttached').mockReturnValue(false);
      playing.playback.pause();
      await flush();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      const drain = vi.spyOn(budget, 'drain');

      budget.clear();
      await vi.advanceTimersByTimeAsync(5000);

      expect(drain).not.toHaveBeenCalled();
      [playing, parked].forEach(({ playback }) => playback.dispose());
    });
  });
});

// Drives many controllers through random, widget-like sequences and checks
// the budget invariants after every step, so new code paths that load or
// play a video outside of the budget are caught.
describe('WebosDecoderBudget invariants', () => {
  const LIMIT = 2;
  const report = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    report.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  const SLOTS = 5;

  // Small deterministic PRNG so failures can be reproduced by seed.
  const random = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  interface Slot {
    element: TestVideo;
    playback: WebosVideoPlayback;
    attached: boolean;
    ready: boolean;
  }

  const createSlot = (budget: WebosDecoderBudget, index: number): Slot => {
    const element = new TestVideo();
    element.readyState = 0;
    const playback = new WebosVideoPlayback(element, report, undefined, budget);
    const slot: Slot = { element, playback, attached: true, ready: false };
    vi.spyOn(playback, 'isAttached').mockImplementation(() => slot.attached);
    vi.spyOn(playback, 'displayArea').mockReturnValue(index);
    // Mirrors the video widget: the source is assigned once loadable.
    void playback.whenLoadable().then(() => {
      if (slot.playback !== playback || element.src) return;
      element.src = `file:///media/castmill/${index}.mp4`;
      slot.ready = true;
    });
    return slot;
  };

  const checkInvariants = (budget: WebosDecoderBudget, slots: Slot[]) => {
    const sources = slots.filter(({ element }) => element.src).length;
    const playing = slots.filter(({ element }) => !element.paused).length;
    expect(budget.size).toBeLessThanOrEqual(LIMIT);
    expect(sources).toBeLessThanOrEqual(budget.size);
    expect(playing).toBeLessThanOrEqual(LIMIT);
  };

  it.each(Array.from({ length: 25 }, (_, seed) => seed + 1))(
    'never loads or plays more than the limit (seed %i)',
    async (seed) => {
      const next = random(seed);
      const pick = <T>(items: T[]) => items[Math.floor(next() * items.length)];
      const budget = new WebosDecoderBudget(LIMIT);
      const slots = Array.from({ length: SLOTS }, (_, index) =>
        createSlot(budget, index)
      );
      await flush();

      for (let step = 0; step < 200; step++) {
        const index = Math.floor(next() * SLOTS);
        const slot = slots[index];
        const action = pick([
          'metadata',
          'metadata',
          'play',
          'play',
          'seek',
          'pause',
          'pause',
          'toggle-attached',
          'wait',
          'wait',
          'replace',
        ]);
        if (action === 'metadata') {
          const loading = slots.filter(
            ({ element }) => element.src && element.readyState === 0
          );
          if (loading.length > 0) pick(loading).element.loaded();
        } else if (action === 'play' && slot.ready) {
          slot.playback.play(Math.floor(next() * 3) * 1000);
        } else if (action === 'seek' && slot.ready) {
          slot.playback.seek(Math.floor(next() * 3) * 1000);
        } else if (action === 'pause' && slot.ready) {
          slot.playback.pause();
        } else if (action === 'toggle-attached') {
          slot.attached = !slot.attached;
        } else if (action === 'wait') {
          await vi.advanceTimersByTimeAsync(Math.floor(next() * 2000));
        } else if (action === 'replace') {
          slot.playback.dispose();
          slots[index] = createSlot(budget, index);
        }
        await flush();
        checkInvariants(budget, slots);
      }

      // Liveness: once everything else is paused, requested videos play,
      // including after a metadata timeout backoff.
      slots.forEach((slot) => {
        slot.attached = true;
        if (slot.ready) slot.playback.pause();
      });
      const chosen: Slot[] = [];
      for (let elapsed = 0; elapsed < 45_000; elapsed += 100) {
        slots.forEach((slot) => {
          if (slot.element.src && slot.element.readyState === 0) {
            slot.element.loaded();
          }
          if (chosen.length < LIMIT && slot.ready && chosen.indexOf(slot) < 0) {
            chosen.push(slot);
            slot.playback.play(0);
          }
        });
        await vi.advanceTimersByTimeAsync(100);
        checkInvariants(budget, slots);
      }
      expect(chosen).toHaveLength(LIMIT);
      chosen.forEach(({ element }) => expect(element.paused).toBe(false));

      slots.forEach(({ playback }) => playback.dispose());
      expect(budget.size).toBe(0);
      expect(budget.waiting).toBe(0);
      expect(slots.every(({ element }) => !element.src)).toBe(true);
    }
  );
});
