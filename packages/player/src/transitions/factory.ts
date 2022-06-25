import { CrossFade } from "./crossfade";
import { SideScroll } from "./side-scroll";
import { Flip } from "./flip";

export interface JsonTransition {
  uri: string;
  opts?: { duration: number; ease?: string };
}

export const fromJSON = async (json: JsonTransition) => {
  // TODO: only allow trusted uris
  if (json.uri.startsWith("https://")) {
    // const ExternalTransition = await import(/* @vite-ignore */ `./${json.uri}`);
    // return new ExternalTransition(json.opts);
  } else {
    switch (json.uri) {
      case "transition://crossfade":
        return new CrossFade(json.opts);
      case "transition://side-scroll":
        return new SideScroll(json.opts);
      case "transition://flip":
        return new Flip(json.opts);
    }
  }
};
