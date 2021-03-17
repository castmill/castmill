<template>
  <div>
    <span>{{ timeFormat(position / 1000) }}</span>
    <button type="button" @click="playStop()">
      {{ isPlaying ? "Stop" : "Play" }}
    </button>
    <input
      type="range"
      step="0.1"
      min="0"
      :max="playlist.duration()"
      v-model="position"
    />
    <span>{{ timeFormat(playlist.duration() / 1000) }}</span>
    <input :disabled="isPlaying" type="checkbox" v-model="loop" />
    <span>Loop</span>
  </div>
</template>

<script lang="ts">
import { Subscription } from "rxjs";
import * as Vue from "vue";
import { Playlist } from "../playlist";
import { Renderer } from "../renderer";
import { Player } from "../player";

export default Vue.defineComponent({
  props: {
    playlist: { type: Playlist, required: true },
    renderer: { type: Renderer, required: true },
  },
  data() {
    return {
      time: 0,
      isPlaying: false,
      playing$: new Subscription(),
      seeking$: new Subscription(),
      loop: true,
    } as {
      time: number;
      isPlaying: boolean;
      playing$: Subscription;
      seeking$: Subscription;
      loop: boolean;
      player?: Player;
    };
  },
  created() {
    this.player = new Player(this.playlist, this.renderer);

    this.player.on("end", () => {
      console.log("Playlist ended");
    });
  },
  mounted() {
    this.player?.on("time", (time) => {
      this.time = time;
    });
    this.player?.on("completed", () => {
      this.isPlaying = false;
      this.position = 0;
    });
    this.playlist.seek(0);
    this.playlist.show(this.renderer).subscribe(() => void 0);

    this.play();
  },
  computed: {
    position: {
      get(): number {
        return this.time;
      },
      set(value: string) {
        this.time = parseInt(value);
        const isPlaying = this.isPlaying;
        if (isPlaying) {
          this.stop();
        }
        this.seeking$.unsubscribe();
        this.playlist.seek(parseFloat(value));
        this.seeking$ = this.playlist
          .show(this.renderer)
          .subscribe(() => void 0);
        if (isPlaying) {
          this.play();
        }
      },
    },
  },
  methods: {
    async playStop() {
      if (this.isPlaying) {
        return this.stop();
      } else {
        return this.play();
      }
    },

    play() {
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.player?.play({ loop: this.loop });
      }
    },

    async stop() {
      this.isPlaying = false;
      this.player?.stop();
    },

    timeFormat(value: string) {
      let seconds = parseInt(value);
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
    },
  },
});
</script>

<style scoped></style>
