import { Playlist } from "../../src/playlist";
import { Renderer } from "../../src/renderer";
import { Layout } from "../../src/widgets/layout";
import { Layer } from "../../src/layer";
import { Image } from "../../src/widgets/image";
import { Video } from "../../src/widgets/video";
import { Text } from "../../src/widgets/text";
import { TextScroll } from "../../src/widgets/text-scroll";
import { Player } from "../../src/player";

const layerScroll = new Layer("Scroll", {
  duration: 13000,
  widget: new TextScroll({
    speed: 10,
    text: [
      {
        fontFamily: "Impact",
        color: "#fff",
        str: "But don't get too depressed",
      },
      {
        fontFamily: "Verdana",
        color: "#f0f",
        str: "     the journey is everything, or so they say...",
      },
    ],
  }),
});

const layer0 = new Layer("laurie", {
  duration: 4000,
  widget: new Image({
    src:
      "https://i.pinimg.com/originals/75/fe/c1/75fec1c2731e49bcb1922beaa3311f80.jpg",
  }),
});

const layer1 = new Layer("girl", {
  duration: 2000,
  widget: new Image({
    src:
      "http://www.stockvault.net/blog/wp-content/uploads/2013/11/Portrait-8.jpg",
  }),
});

const layer2 = new Layer("nicholsson", {
  duration: 2000,
  widget: new Image({
    src:
      "https://s-media-cache-ak0.pinimg.com/originals/ef/83/60/ef83604a2bedd8043ccc2fe56fed3bc7.jpg",
  }),
});

const layer3 = new Layer("dicaprio", {
  duration: 2000,
  widget: new Image({
    src: "https://media.timeout.com/images/103023930/750/422/image.jpg",
  }),
});

const layer4 = new Layer("bigunny", {
  duration: 5000,
  widget: new Video({
    src:
      "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    volume: 0,
  }),
});

const layer5 = new Layer("deniro", {
  duration: 3000,
  widget: new Image({
    src:
      "https://cdn.artphotolimited.com/images/5b9fc1ecac06024957be8806/300x300/portrait-de-robert-de-niro-1975.jpg",
  }),
});

const layer6 = new Layer("elephantsdream", {
  duration: 8000,
  widget: new Video({
    src:
      "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    volume: 0,
  }),
});

const layer7 = new Layer("watts", {
  duration: 3000,
  widget: new Image({
    src:
      "https://i.pinimg.com/originals/b9/56/38/b95638487bc59956c40469a39996275c.jpg",
  }),
});

const layer8 = new Layer("berry", {
  duration: 3000,
  widget: new Image({
    src:
      "https://www.jasonbellphoto.com/wp-content/uploads/2016/05/Halle-Berry-new.jpg",
  }),
});

const layerAdvice = new Layer("text1", {
  duration: 2000,
  widget: new Text({
    text: "Let me give you an advice",
    css: { color: "FFF", fontSize: "3em", fontFamily: "Verdana" },
  }),
});

const layerAdvice2 = new Layer("text2", {
  duration: 4000,
  widget: new Text({
    text: "You may feel young now...",
    css: { color: "FFF", fontSize: "3em", fontFamily: "Verdana" },
  }),
});

const layerAdvice3 = new Layer("text3", {
  duration: 4000,
  widget: new Text({
    text: "but time is inexorable",
    css: {
      color: "FFF",
      fontSize: "3em",
      fontFamily: "Verdana",
      fontWeight: "bold",
    },
  }),
});

const layerAdvice4 = new Layer("text4", {
  duration: 4000,
  widget: new Text({
    text: "before you know it",
    css: {
      color: "FFF",
      fontSize: "3em",
      fontFamily: "Verdana",
      fontWeight: "bold",
    },
  }),
});

const layerAdvice5 = new Layer("text5", {
  duration: 4000,
  widget: new Text({
    text: "it's over",
    css: {
      color: "FFF",
      fontSize: "3em",
      fontFamily: "Impact",
      fontWeight: "bold",
    },
  }),
});

const layerAdvice6 = new Layer("text6", {
  duration: 4000,
  widget: new Text({
    text: "And now lets watch a movie",
    css: {
      color: "FFF",
      fontSize: "6em",
      fontFamily: "Impact",
      fontWeight: "bold",
      textAlign: "center",
    },
  }),
});

const root = document.getElementById("wrapper");
if (!root) {
  throw new Error("could not find wrapper element");
}
const renderer = new Renderer(root);

const playlist = new Playlist("Main");

playlist.add(layer6);

const layoutWidget = new Layout("Complex");
const layout = new Layer("layout", {
  widget: layoutWidget,
});

playlist.add(layout);

// For better ergonomics we should probably create the Playlist when adding new containers to a given
// layout.
const layoutPlaylist1 = new Playlist("Layout1");
layoutPlaylist1.add(layerAdvice);
layoutPlaylist1.add(layerAdvice2);
layoutPlaylist1.add(layerAdvice3);
layoutPlaylist1.add(layerAdvice4);
layoutPlaylist1.add(layerAdvice5);
layoutPlaylist1.add(layerScroll);

layoutWidget.add({
  css: {
    top: "0%",
    left: "0%",
    width: "100%",
    height: "20%",
    opacity: "0.7",
  },
  playlist: layoutPlaylist1,
});

const layoutPlaylist2 = new Playlist("Layout2");
layoutPlaylist2.add(layer0);
layoutPlaylist2.add(layer1);
layoutPlaylist2.add(layer5);
layoutPlaylist2.add(layer2);

layoutWidget.add({
  css: {
    top: "0%",
    left: "0%",
    width: "100%",
    height: "100%",
    opacity: "0.5",
  },
  playlist: layoutPlaylist2,
});

/*
playlist.add(layerAdvice6);
playlist.add(layer4);
*/
/*
const layoutPlaylist3 = new Playlist("Text scroller");
layoutPlaylist3.add(layerScroll);
// layoutPlaylist3.add(layerScroll2);

layoutWidget.add({
  css: {
    bottom: "0",
    left: "0%",
    width: "100%",
    height: "15%",
    opacity: "0.8",
  },
  playlist: layoutPlaylist3,
});
*/

/*
  var container2 = layout.add({
    top: "0%",
    left: "50%",
    width: "50%",
    height: "50%",
    opacity: 0.5
  });

  container2.add(layer5);
  container2.add(layer6);

  playlist.add(layer5);
*/
//playlist.play(server);
/*
playlist.add(layer0);
playlist.add(layer1);
playlist.add(layer2);
*/
/*

playlist.add(layer3);
playlist.add(layer6);
playlist.add(layer2);
playlist.add(layer4);
playlist.add(layer3);
playlist.add(layer5);
*/

/*
playlist.add(layer1);
playlist.add(layer0);
playlist.add(layer2);
playlist.add(layer3);
*/
//playlist.add(layer6);

const playlist2 = new Playlist("test");
playlist2.add(layer3);
playlist2.add(layer7);
playlist2.add(layer8);

const player = new Player(playlist, renderer);

player.play({ loop: true });
