import { JsonPlaylist } from "./";
export interface JsonLayout {
  name: string;
  args: {
    duration: number;
  };
  items: {
    playlist: JsonPlaylist;
    css: Partial<CSSStyleDeclaration>;
  }[];
}
