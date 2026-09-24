import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebosVideoPlayback } from './webos-video-playback';

class TestVideo extends EventTarget {
  readyState = 1;
  ended = false;
  src = '';
  error = null;
  position = 0;
  seekError: unknown;
  seek = vi.fn();
  play = vi.fn();
  pause = vi.fn();
  load = vi.fn(() => {
    this.readyState = 0;
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
      vi.useRealTimers();
    }
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

  it('preserves paused nonzero seeks after metadata arrives', async () => {
    video.readyState = 0;
    controller.seek(4500);
    await flush();
    video.loaded();
    await flush();
    expect(video.currentTime).toBe(4.5);
    expect(video.play).not.toHaveBeenCalled();
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
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    const replacement = `http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`;
    const refresh = vi.fn().mockResolvedValue(replacement);
    controller.dispose();
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

  it('does not restart a failed video after it is paused during recovery', async () => {
    video.src = `http://127.0.0.1:9080/castmill-cache/${'a'.repeat(64)}.mp4`;
    let resolve!: (url: string) => void;
    const refresh = vi.fn().mockReturnValue(
      new Promise<string>((done) => {
        resolve = done;
      })
    );
    controller.dispose();
    controller = new WebosVideoPlayback(video, report, refresh);
    controller.play(4000);
    await flush();
    video.dispatchEvent(new Event('error'));
    controller.pause();
    resolve(`http://127.0.0.1:9080/castmill-cache/${'b'.repeat(64)}.mp4`);
    await flush();
    expect(video.play).toHaveBeenCalledOnce();
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
});
