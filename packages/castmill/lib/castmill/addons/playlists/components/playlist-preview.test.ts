import { describe, expect, it } from "vitest";
import type { JsonPlaylist, Playlist } from "@castmill/player";

import { resolvePlaylistDuration } from "./playlist-preview";

describe("resolvePlaylistDuration", () => {
  it("keeps a measured video duration when a static item duration changes", () => {
    const playlist = {
      layers: [{ duration: () => 10_000 }, { duration: () => 10_000 }],
    } as unknown as Playlist;
    const items = [
      { id: 1, duration: 0 },
      { id: 2, duration: 10_000 },
    ] as JsonPlaylist["items"];

    expect(resolvePlaylistDuration(playlist, items, { 1: 3_000 })).toBe(13_000);
  });
});
