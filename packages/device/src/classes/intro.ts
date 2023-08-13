import { JsonLayer, Layer, TemplateComponentType } from "@castmill/player";

import castmillLogo from "../assets/logo.png";
import { ResourceManager } from "@castmill/cache";

const createImageLayer = (imageUrl: string) => ({
  name: `image-layer`,
  duration: 10000,
  slack: 1000,
  widget: {
    name: "image",
    template: {
      type: "image" as TemplateComponentType.Image,
      opts: {
        url: castmillLogo,
        size: "contain",
      },
      style: {
        "background-size": "contain",
      },
      animations: [
        {
          keyframes: [
            {
              set: {
                filter: "blur(0px)",
              },
              from: {
                filter: "blur(100px)",
                duration: 2,
                ease: "power1.inOut",
              },
              to: {
                translateX: "-40%",
                translateY: "45%",
                scale: 0.2,
                duration: 1,
                ease: "power1.inOut",
              },
            },
            {
              to: {
                translateX: "40%",
                translateY: "45%",
                duration: 1,
                ease: "power1.inOut",
              },
            },
            {
              to: {
                translateX: "40%",
                translateY: "-45%",
                duration: 1,
                ease: "power1.inOut",
              },
            },
            {
              to: {
                translateX: "-40%",
                translateY: "-45%",
                duration: 1,
                ease: "power1.inOut",
              },
            },
            {
              to: {
                translateX: "0%",
                translateY: "0%",
                scale: 1,
                duration: 1,
                ease: "power1.inOut",
              },
            },
            {
              to: {
                filter: "blur(100px)",
                duration: 3,
                ease: "power1.inOut",
              },
            },
          ],
        },
      ],
      name: "image",
    },
    config: {
      assets: {
        medias: { imageUrl, castmillLogo },
      },
    },
    style: {
      width: "100%",
      height: "100%",
    },
    medias: [imageUrl, castmillLogo],
  },
});

export function getCastmillIntro(resourceManager: ResourceManager): Layer {
  return Layer.fromJSON(
    (<unknown>createImageLayer(castmillLogo)) as JsonLayer,
    resourceManager
  );
}

/*
export function getCastmillIntro(resourceManager: ResourceManager): Playlist {
  const jsonPlaylist = {
    name: "Castmill Logo Intro",
    layers: [createImageLayer(castmillLogo)],
  };

  return Playlist.fromJSON(jsonPlaylist, resourceManager);
}
*/
