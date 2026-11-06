import { createStore } from 'solid-js/store';
import { baseUrl } from '../../env';
import { ChannelsService } from '../../services/channels.service';

/**
 * Client-side cache of playlist names, used by rule summaries
 * (rules only store playlist ids).
 */
const [names, setNames] = createStore<Record<number, string>>({});
const pending = new Set<string>();

export const playlistName = (id: number): string | undefined => names[id];

export const rememberPlaylist = (id: number, name: string) =>
  setNames(id, name);

export const loadPlaylistNames = async (
  organizationId: string,
  ids: number[]
) => {
  const service = new ChannelsService(baseUrl, organizationId);
  await Promise.all(
    Array.from(new Set(ids))
      .filter((id) => id && names[id] === undefined)
      .map(async (id) => {
        const key = `${organizationId}:${id}`;
        if (pending.has(key)) return;
        pending.add(key);
        try {
          const result = await service.fetchPlaylist(id);
          if (result?.data?.name) rememberPlaylist(id, result.data.name);
        } catch {
          // The summary falls back to the playlist id.
        } finally {
          pending.delete(key);
        }
      })
  );
};

/** Playlist ids referenced by the actions of the given rules. */
export const referencedPlaylistIds = (
  rules: Array<{ then?: { config?: Record<string, unknown> } }>
) =>
  rules
    .map((rule) => Number(rule.then?.config?.playlist_id))
    .filter((id) => Number.isFinite(id) && id > 0);
