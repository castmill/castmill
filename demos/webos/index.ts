import { Playlist } from "../../src/playlist";
import { Renderer } from "../../src/renderer";
import { Layout } from "../../src/widgets/layout";
import { Layer } from "../../src/layer";
import { Video } from "../../src/widgets/video";
import { Player } from "../../src/player";

const layer1 = new Layer("video1", {
  duration: 1000,
  widget: new Video({
    volume: 0,
    src:
      "https://castmill-medias.s3.eu-central-1.amazonaws.com/main/5f20119aa08a9800110adea8/adcc6996-c678-42a6-915e-ddc80a0ee904.mp4",
  }),
});

const layer2 = new Layer("video2", {
  duration: 1000,
  widget: new Video({
    volume: 0,
    src:
      "https://castmill-medias.s3.eu-central-1.amazonaws.com/main/5f20119aa08a9800110adea8/8cd759a7-af82-428a-8c87-fa7dabe5a9f6.mp4",
  }),
});

const layer3 = new Layer("video3", {
  duration: 1000,
  widget: new Video({
    volume: 0,
    src:
      "https://castmill-medias.s3.eu-central-1.amazonaws.com/main/5f20119aa08a9800110adea8/f6a8e1cf-4d16-473f-adb2-83961b2fa2ef.mp4",
  }),
});

const layer4 = new Layer("video4", {
  duration: 1000,
  widget: new Video({
    volume: 0,
    src:
      "https://castmill-medias.s3.eu-central-1.amazonaws.com/main/5f20119aa08a9800110adea8/b07928a7-7c25-46a9-b003-4b53e39adf97.mp4",
  }),
});

const root = document.getElementById("wrapper");
if (!root) {
  throw new Error("could not find wrapper element");
}
const renderer = new Renderer(root);

const playlist = new Playlist("Main");

const layoutWidget = new Layout("Top");
const layout = new Layer("layout", {
  widget: layoutWidget,
});

playlist.add(layout);

// For better ergonomics we should probably create the Playlist when adding new containers to a given
// layout.
const topLayoutPlaylist = new Playlist("Layout1");
topLayoutPlaylist.add(layer1);
topLayoutPlaylist.add(layer2);

layoutWidget.add({
  css: {
    top: "0%",
    left: "0%",
    width: "100%",
    height: "50%",
  },
  playlist: topLayoutPlaylist,
});

const bottomLayoutPlaylist = new Playlist("Layout2");
bottomLayoutPlaylist.add(layer3);
bottomLayoutPlaylist.add(layer4);

layoutWidget.add({
  css: {
    top: "50%",
    left: "0%",
    width: "100%",
    height: "50%",
  },
  playlist: bottomLayoutPlaylist,
});

const player = new Player(playlist, renderer);

player.play({ loop: true });
