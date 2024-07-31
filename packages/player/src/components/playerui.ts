/**
 *
 * Vanilla Player UI for Castmill Player.
 * Userful for embedding the player in a webpage.
 *
 * (c) 2022 Castmill AB
 */
import {
  exhaustMap,
  fromEvent,
  Observable,
  of,
  share,
  Subscription,
  switchMap,
} from 'rxjs';
import { Playlist, Renderer, Player, Viewport } from '../';
import gsap from 'gsap';
import playIcon from '../icons/play.png';

const controlsTemplate = (id: string) => `
<div>
  <div id="playerui-controls-${id}" style="z-index: 9999;
    position: absolute;
    bottom: 0;
    width: 100%;
    background: rgba(0,0,0,0.5);
    color: white;
    height: 2em;
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;">
    <div style="flex-grow: 1; display: flex; align-items: center;">
      <span id="time-${id}" style="margin:0 0.5em"></span>
      <input
          id="seek-${id}"
          style="
            width: 80%;
            -webkit-appearance: none;
            background-color: #ad3030;
            border-radius: 8px;
            height: 5px;"
          type="range"
          value="0"
          step="0.1"
          min="0"
      />
      <span id="duration-${id}" style="margin:0 0.5em"></span>
    </div>
    <div style="padding-right: 0.5em;">
      <input id="loop-${id}" type="checkbox"/>
      <label>Loop</label>
    </div>
  </div>
  <div id="play-${id}" style="
      display: flex;
      position: absolute; 
      top: 0; left: 0; right: 0; bottom: 0;
      opacity: 0.5;
      cursor: pointer;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      ">
      <div style="
        background: url(${playIcon}) center / contain no-repeat;
        width: 50%;
        height: 50%;
        "></div>
  </div>
</div>
`;

const template = (id: string) => `
  <div id="playerui-${id}">
    <div id="player-${id}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;"></div>
  </div>
`;

function htmlToElement(html: string) {
  const template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
}

export interface PlayerUIControlsPosition {
  bottom?: string;
  width?: string;
  left?: string;
  height?: string;
}

export class PlayerUIControls {
  controls: HTMLDivElement;
  playing = false;

  $play: Observable<{ evt: Event; timestamp: number }>;
  $keyboard: Observable<{ evt: KeyboardEvent; timestamp: number }>;

  playTimeline: gsap.core.Timeline;
  stopTimeline: gsap.core.Timeline;

  elements: {
    controls: HTMLDivElement;
    play: HTMLButtonElement;
    time: HTMLSpanElement;
    seek: HTMLInputElement;
    duration: HTMLSpanElement;
    loop: HTMLInputElement;
  };

  constructor(
    private id: string,
    opts: { position?: PlayerUIControlsPosition } = {}
  ) {
    this.controls = <HTMLDivElement>htmlToElement(controlsTemplate(this.id));

    document.querySelector(`#${id}`)?.appendChild(this.controls);

    this.elements = {
      controls: this.controls.querySelector(
        `#playerui-controls-${id}`
      ) as HTMLDivElement,
      play: this.controls.querySelector(`#play-${id}`) as HTMLButtonElement,
      time: this.controls.querySelector(`#time-${id}`) as HTMLSpanElement,
      seek: this.controls.querySelector(`#seek-${id}`) as HTMLInputElement,
      duration: this.controls.querySelector(
        `#duration-${id}`
      ) as HTMLSpanElement,
      loop: this.controls.querySelector(`#loop-${id}`) as HTMLInputElement,
    };

    if (opts?.position) {
      const { bottom, width, left, height } = opts.position;
      this.elements.controls.style.bottom =
        bottom ?? this.elements.controls.style.bottom;
      this.elements.controls.style.width =
        width ?? this.elements.controls.style.width;
      this.elements.controls.style.left =
        left ?? this.elements.controls.style.left;
      this.elements.controls.style.height =
        height ?? this.elements.controls.style.height;
    }

    this.setTimeDuration(0, 0, true);

    this.playTimeline = gsap
      .timeline({
        paused: true,
      })
      .to(this.elements.play, {
        opacity: 0,
        duration: 0.5,
        scale: 1.5,
        ease: 'back',
      });

    this.stopTimeline = gsap
      .timeline({
        paused: true,
      })
      .to(this.elements.play, {
        opacity: 0.5,
        duration: 0.3,
        scale: 1,
        ease: 'back',
      });

    const animatePlay = <T>(evt: T) => {
      this.playing = !this.playing;
      return new Observable<{ evt: T; timestamp: number }>((observer) => {
        observer.next({ evt, timestamp: Date.now() });
        observer.complete();
        if (this.playing) {
          this.playTimeline.seek(0);
          this.playTimeline.play();
        } else {
          this.stopTimeline.seek(0);
          this.stopTimeline.play();
        }
      });
    };

    this.$play = fromEvent(this.elements.play, 'click').pipe(
      switchMap((evt) => animatePlay<Event>(evt)),
      share()
    );

    this.$keyboard = fromEvent<KeyboardEvent>(document, 'keydown').pipe(
      switchMap((evt) => {
        // Hack so that we can animate the play button
        const { key, code, keyCode } = evt;
        if (key == ' ' || code == 'Space' || keyCode == 32) {
          return animatePlay<KeyboardEvent>(evt);
        }
        return of({ evt, timestamp: Date.now() });
      }),
      share()
    );
  }

  public loopObservable() {
    return fromEvent(this.elements.loop, 'change');
  }

  public seekObservable() {
    return fromEvent(this.elements.seek, 'input');
  }

  public playObservable() {
    return this.$play;
  }

  public keyboardObservable() {
    return this.$keyboard;
  }

  public setTimeDuration(time: number, duration: number, loop: boolean) {
    this.updateTime(time);
    this.elements.seek.max = `${duration}`;
    this.elements.duration.textContent = timeFormat(duration / 1000);
    this.elements.loop.checked = loop;
  }

  public updateTime(time: number) {
    this.elements.time.textContent = timeFormat(time / 1000, true);
    this.elements.seek.value = `${time}`;
  }

  get seek() {
    return Number(this.elements.seek.value);
  }

  disableLoop({ loop }: { loop: boolean }) {
    if (this.elements.loop) {
      this.elements.loop.disabled = loop;
    }
  }

  destroy() {
    // Kill GSAP animations to free up resources.
    this.playTimeline.kill();
    this.stopTimeline.kill();

    // Remove the controls from the DOM
    this.controls.remove();
  }
}

export interface PlayerUIOptions {
  viewport?: Viewport;
  controls?: PlayerUIControls;
  controlsMaster?: boolean;
  synced?: boolean;
}

export class PlayerUI {
  time = 0;
  isPlaying = false;
  playing$ = new Subscription();
  loop = true;

  player: Player;
  renderer: Renderer;
  ui: HTMLDivElement;

  private durationSubscription?: Subscription;
  private keyboardSubscription?: Subscription;
  private seekSubscription?: Subscription;
  private loopSubscription?: Subscription;
  private playSubscription?: Subscription;

  constructor(
    private id: string,
    private playlist: Playlist,
    private opts: PlayerUIOptions = {}
  ) {
    this.ui = document.createElement('div');
    this.ui.innerHTML = template(this.id);

    document.querySelector(`#${id}`)?.appendChild(this.ui);

    const playerElement = this.ui.querySelector(
      `#player-${id}`
    ) as HTMLDivElement;

    const renderer = (this.renderer = new Renderer(playerElement));

    this.player = new Player(this.playlist, renderer, opts.viewport);

    this.mounted();

    if (opts.controls) {
      this.playSubscription = opts.controls
        .playObservable()
        .subscribe(({ timestamp }) => this.playStop(timestamp));

      this.loopSubscription = opts.controls
        .loopObservable()
        .subscribe((loop) => {
          this.loop = (<HTMLInputElement>loop.target)?.checked; //this.elements.loop.checked;
        });

      // We should even improve it with
      // https://stackoverflow.com/questions/51821942/operator-similar-to-exhaustmap-but-that-remembers-the-last-skipped-value-from-th
      this.seekSubscription = opts.controls
        .seekObservable()
        .pipe(exhaustMap(() => this.seek(opts.controls!.seek)))
        .subscribe();

      opts.controls!.setTimeDuration(this.time, playlist.duration(), this.loop);

      this.keyboardSubscription = opts.controls
        .keyboardObservable()
        .subscribe(({ evt, timestamp }) => {
          const { key, code, keyCode } = evt;
          if (key == ' ' || code == 'Space' || keyCode == 32) {
            this.playStop(timestamp);
          }

          if (key == 'ArrowRight' || code == 'ArrowRight' || keyCode == 39) {
            this.forward();
          }

          if (key == 'ArrowLeft' || code == 'ArrowLeft' || keyCode == 37) {
            this.backward();
          }
        });
    }
  }

  destroy() {
    this.stop();
    this.ui.remove();
    this.durationSubscription?.unsubscribe();
    this.keyboardSubscription?.unsubscribe();
    this.seekSubscription?.unsubscribe();
    this.loopSubscription?.unsubscribe();
    this.playSubscription?.unsubscribe();
  }

  mounted() {
    if (this.opts.controlsMaster) {
      this.player?.on('time', (time) => {
        this.opts.controls?.updateTime(time);
      });
    }
    this.player?.on('completed', () => {
      this.stop();
      this.seek(0);
    });
    this.playlist.seek(0);
    this.playlist.show(this.renderer).subscribe(() => void 0);
  }

  get position(): number {
    return this.time;
  }

  /**
   * Seeks to the next item in the playlist
   */
  forward() { }

  /**
   * Seeks to the previous item in the playlist
   */
  backward() { }

  seek(value: number) {
    const time = (this.time = value);

    if (this.opts?.controls) {
      this.opts.controls.updateTime(time);
    }

    const isPlaying = this.isPlaying;
    if (isPlaying) {
      this.player.stop();
    }

    this.playlist.seek(parseFloat(`${value}`));
    this.playlist.time = value;
    return this.playlist.show(this.renderer).pipe(
      switchMap(() => {
        if (isPlaying) {
          this.player.play({
            loop: this.loop,
            synced: this.opts.synced,
            baseline: Date.now(),
          });
        }
        return of(null);
      })
    );
  }

  async playStop(baseline: number) {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play(baseline);
    }
  }

  play(baseline: number) {
    if (!this.isPlaying) {
      if (this.opts.controls) {
        this.opts.controls.disableLoop({ loop: true });
      }

      this.isPlaying = true;
      this.player?.play({
        loop: this.loop,
        synced: this.opts.synced,
        baseline,
      });
    }
  }

  async stop() {
    if (this.opts.controls) {
      this.opts.controls.disableLoop({ loop: false });
    }

    this.isPlaying = false;
    this.player?.stop();
  }
}

function timeFormat(value: number, tenths = false) {
  let seconds = parseInt(`${value}`, 10);
  seconds = seconds < 0 ? 0 : seconds;
  let s = Math.floor(seconds % 60) as any;
  let m = Math.floor((seconds / 60) % 60) as any;
  let h = Math.floor(seconds / 3600) as any;

  // Check if we need to show hours
  h = h > 0 ? h + ':' : '';

  // If hours are showing, we may need to add a leading zero.
  // Always show at least one digit of minutes.
  m = (h && m < 10 ? '0' + m : m) + ':';

  // Check if leading zero is need for seconds
  s = s < 10 ? '0' + s : s;

  const tenth = tenths ? `:${Math.floor((value * 10) % 10)}` : '';

  // Return the final time
  return h + m + s + tenth;
}
