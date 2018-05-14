<template>
  <div>
    <span>{{position}}</span>
    <button type="button" @click="playStop()">{{isPlaying ? 'Stop' : 'Play'}}</button>
    <input type="range" step="0.1" min="0" :max="duration" v-model="position">
    <span>{{duration}}</span>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";
import { Playlist } from "../playlist";
import { PlayServer } from "../play-server";

@Component
export default class Player extends Vue {
  @Prop() playlist!: Playlist;
  @Prop() server!: PlayServer;

  // Should not be properties but reactivity does not work.
  @Prop()
  duration: number = 0;
  @Prop()
  isPlaying: boolean = false;

/*
  @Watch('offset')
  onPositionChanged(val: number){
    this.playlist.seek(val);
  }
*/

  constructor(){
    super();
    console.log("player")
    this.playlist.show(this.server).then( () => {
      return this.playlist.duration();
    }).then( duration => {
      this.duration = duration;
    });

    this.playlist.on('end', () => {
      this.isPlaying = false;
      this.playlist.seek(0);
    })
  }

  get position(): string {
    return this.playlist.offset.toString();
  }

  set position(value: string) {
    this.playlist.seek(parseFloat(value));
  }

  async playStop() {
    if (this.isPlaying) {
      return this.stop();
    } else {
      return this.play();
    }
  }

  async play(): Promise<void> {
    this.isPlaying = true;
    return this.playlist.play(this.server);
  }

  async stop() {
    this.isPlaying = false;
    return this.playlist.stop();
  }
}
</script>

<style scoped></style>
