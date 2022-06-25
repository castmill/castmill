/**
 *
 * Vanilla Player UI for Castmill Player.
 * Userful for embedding the player in a webpage.
 *
 * (c) 2022 Castmill AB
 */
import { fromEvent, Subscription } from "rxjs";
import { Playlist, Renderer, Player } from "../";
import gsap from "gsap";
import playIcon from "../icons/play.png";

const template = (id: string) => `
  <div id="playerui-${id}">
    <div id="player-${id}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;"></div>
    <div id="play-${id}" style="
      display: flex;
      position: absolute; 
      top: 0; left: 0; right: 0; bottom: 0;
      opacity: 0.5;
      cursor: pointer;
      justify-content: center;
      align-items: center;
      z-index: 9;
      ">
      <div style="
        background: url(${playIcon}) center / contain no-repeat;
        width: 50%;
        height: 50%;
        "></div>
    </div>
    <div id="playerui-controls-${id}" style="z-index: 10;
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
        <div>
          <input id="loop-${id}" type="checkbox"/>
          <label>Loop</label>
        </div>
    </div>
    </div>
  </div>
`;

function htmlToElement(html: string) {
  var template = document.createElement("template");
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
}

export class PlayerUI {
  time = 0;
  isPlaying = false;
  playing$ = new Subscription();
  seeking$ = new Subscription();
  loop = true;

  player: Player;
  renderer: Renderer;
  ui: HTMLDivElement;

  elements: {
    play: HTMLButtonElement;
    time: HTMLSpanElement;
    seek: HTMLInputElement;
    duration: HTMLSpanElement;
    loop: HTMLInputElement;
  };

  private durationSubscription: Subscription;
  private keyboardSubscription: Subscription;

  constructor(private id: string, private playlist: Playlist) {
    this.ui = document.createElement("div");
    this.ui.innerHTML = template(this.id);

    document.querySelector(`#${id}`)?.appendChild(this.ui);

    const renderer = (this.renderer = new Renderer(
      this.ui.querySelector(`#player-${id}`)!
    ));

    this.player = new Player(this.playlist, renderer);

    this.mounted();

    this.elements = {
      play: this.ui.querySelector(`#play-${id}`) as HTMLButtonElement,
      time: this.ui.querySelector(`#time-${id}`) as HTMLSpanElement,
      seek: this.ui.querySelector(`#seek-${id}`) as HTMLInputElement,
      duration: this.ui.querySelector(`#duration-${id}`) as HTMLSpanElement,
      loop: this.ui.querySelector(`#loop-${id}`) as HTMLInputElement,
    };

    this.elements.play.addEventListener("click", () => this.playStop());
    this.elements.loop.addEventListener("change", () => {
      this.loop = this.elements.loop.checked;
    });
    this.elements.seek.addEventListener("input", () => {
      this.position = parseFloat(this.elements.seek.value);
    });

    this.durationSubscription = playlist.duration().subscribe((duration) => {
      this.elements.time.textContent = this.timeFormat(this.time / 1000);
      this.elements.seek.max = `${duration}`;
      this.elements.duration.textContent = this.timeFormat(duration / 1000);
      this.elements.loop.checked = this.loop;
    });

    this.keyboardSubscription = fromEvent<KeyboardEvent>(
      document,
      "keydown"
    ).subscribe((e) => {
      if (e.key == " " || e.code == "Space" || e.keyCode == 32) {
        this.playStop();
      }
    });
  }

  destroy() {
    this.stop();
    this.ui.remove();
    this.durationSubscription.unsubscribe();
    this.keyboardSubscription.unsubscribe();
  }

  mounted() {
    this.player?.on("time", (time) => {
      this.elements.time.textContent = this.timeFormat(time / 1000);
      this.elements.seek.value = `${time}`;
    });
    this.player?.on("completed", () => {
      this.stop();
      this.position = 0;
    });
    this.playlist.seek(0);
    this.playlist.show(this.renderer).subscribe(() => void 0);
  }

  get position(): number {
    return this.time;
  }

  set position(value: number) {
    const time = (this.time = parseInt(`${value}`, 10));

    this.elements.time.textContent = this.timeFormat(time / 1000);
    this.elements.seek.value = `${time}`;

    const isPlaying = this.isPlaying;
    if (isPlaying) {
      this.stop();
    }
    this.seeking$?.unsubscribe();
    this.playlist.seek(parseFloat(`${value}`));
    this.playlist.time = value;
    this.seeking$ = this.playlist.show(this.renderer).subscribe(() => void 0);
    if (isPlaying) {
      this.play();
    }
  }

  async playStop() {
    if (this.isPlaying) {
      this.stop();
    } else {
      const tl = gsap
        .timeline({
          paused: true,
        })
        .to(this.elements.play, {
          opacity: 0,
          duration: 0.5,
          scale: 1.5,
          ease: "back",
        });

      tl.play().eventCallback("onComplete", () => {
        this.play();
        tl.kill();
      });
    }
  }

  play() {
    if (!this.isPlaying) {
      this.elements.loop.disabled = true;

      this.isPlaying = true;
      this.player?.play({ loop: this.loop });
    }
  }

  async stop() {
    this.elements.loop.disabled = false;

    this.isPlaying = false;
    this.player?.stop();

    const tl = gsap
      .timeline({
        paused: true,
      })
      .to(this.elements.play, {
        opacity: 0.5,
        duration: 0.3,
        scale: 1,
        ease: "back",
      });

    tl.play();
  }

  timeFormat(value: number) {
    let seconds = parseInt(`${value}`, 10);
    seconds = seconds < 0 ? 0 : seconds;
    let s = Math.floor(seconds % 60) as any;
    let m = Math.floor((seconds / 60) % 60) as any;
    let h = Math.floor(seconds / 3600) as any;

    // Check if we need to show hours
    h = h > 0 ? h + ":" : "";

    // If hours are showing, we may need to add a leading zero.
    // Always show at least one digit of minutes.
    m = (h && m < 10 ? "0" + m : m) + ":";

    // Check if leading zero is need for seconds
    s = s < 10 ? "0" + s : s;
    return h + m + s;
  }
}
