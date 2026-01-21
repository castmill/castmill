import {
  Component,
  createSignal,
  onMount,
  onCleanup,
  Show,
  For,
} from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { DevicesService, JsonChannel } from '../services/devices.service';
import {
  Player,
  Playlist,
  Renderer,
  Layer,
  JsonPlaylist,
} from '@castmill/player';
import { ResourceManager, Cache, StorageDummy } from '@castmill/cache';
import styles from './devices.module.scss';

/**
 * DevicePreview Component
 *
 * Shows a preview of what the device should be playing right now based on
 * its assigned channels and their schedules. This is not the actual content
 * being played on the device (which could be offline or crashed), but rather
 * what it *should* be playing at the current time.
 */
export const DevicePreview: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [channels, setChannels] = createSignal<JsonChannel[]>([]);
  const [currentPlaylistId, setCurrentPlaylistId] = createSignal<number | null>(
    null
  );
  const [currentPlaylistName, setCurrentPlaylistName] =
    createSignal<string>('');
  const [currentChannelName, setCurrentChannelName] = createSignal<string>('');
  const [player, setPlayer] = createSignal<Player | null>(null);

  // Initialize ResourceManager once per component instance and reuse it
  let resourceManager: ResourceManager | null = null;
  let resourceManagerPromise: Promise<ResourceManager> | null = null;
  let playerContainer: HTMLDivElement | undefined;

  /**
   * Get the playlist that should be playing at a given timestamp
   * based on channel scheduling logic
   */
  const getPlaylistAt = (
    channel: JsonChannel,
    timestamp: number
  ):
    | {
        playlist: number;
        endTime: number;
        nextTime: number | undefined;
      }
    | undefined => {
    const entries = channel.entries || [];
    const sortedEntries = [...entries].sort((a, b) => a.start - b.start);

    for (let i = sortedEntries.length - 1; i >= 0; i--) {
      const entry = sortedEntries[i];
      if (
        entry.start <= timestamp &&
        (timestamp < entry.end ||
          (entry.repeat_weekly_until && entry.repeat_weekly_until >= timestamp))
      ) {
        const entryStart = new Date(entry.start);
        const entryEnd = new Date(entry.end);
        const timestampDate = new Date(timestamp);

        const timestampDay = timestampDate.getUTCDay();

        const isBetweenDays =
          timestampDay >= entryStart.getUTCDay() &&
          timestampDay <= entryEnd.getUTCDay();

        if (isBetweenDays) {
          const entryStartHours = entryStart.getUTCHours();
          const entryStartMinutes = entryStart.getUTCMinutes();
          const entryEndHours = entryEnd.getUTCHours();
          const entryEndMinutes = entryEnd.getUTCMinutes();
          const timestampHours = timestampDate.getUTCHours();
          const timestampMinutes = timestampDate.getUTCMinutes();

          const isWithinTime =
            (timestampHours > entryStartHours ||
              (timestampHours === entryStartHours &&
                timestampMinutes >= entryStartMinutes)) &&
            (timestampHours < entryEndHours ||
              (timestampHours === entryEndHours &&
                timestampMinutes <= entryEndMinutes));

          if (isWithinTime) {
            return {
              playlist: entry.playlist_id,
              endTime: entry.end,
              nextTime:
                i + 1 < sortedEntries.length
                  ? sortedEntries[i + 1].start
                  : undefined,
            };
          }
        }
      }
    }

    // Fall back to default playlist if available
    return channel.default_playlist_id
      ? {
          playlist: channel.default_playlist_id,
          endTime: Infinity,
          nextTime: undefined,
        }
      : undefined;
  };

  /**
   * Determine all playlists that should be playing right now from all channels
   * Returns array of { channelName, playlistId } for all active channels
   */
  const determineCurrentPlaylists = (): {
    channelName: string;
    playlistId: number;
  }[] => {
    const channelList = channels();
    if (channelList.length === 0) {
      return [];
    }

    const now = Date.now();
    const activePlaylists: { channelName: string; playlistId: number }[] = [];

    // Check each channel to find what should be playing
    for (const channel of channelList) {
      const result = getPlaylistAt(channel, now);
      if (result) {
        activePlaylists.push({
          channelName: channel.name,
          playlistId: result.playlist,
        });
      }
    }

    return activePlaylists;
  };

  /**
   * Initialize ResourceManager for the preview
   * Protected against concurrent calls - only one initialization will occur
   */
  const initializeResourceManager = async (): Promise<ResourceManager> => {
    // If already initialized, return it
    if (resourceManager) {
      return resourceManager;
    }

    // If initialization is in progress, wait for it
    if (resourceManagerPromise) {
      return resourceManagerPromise;
    }

    // Start new initialization
    resourceManagerPromise = (async () => {
      const storage = new StorageDummy('preview');
      const cache = new Cache(storage);
      const manager = ResourceManager.createResourceManager(cache, {
        baseUrl: props.baseUrl,
      });
      await manager.init();
      resourceManager = manager;
      resourceManagerPromise = null; // Clear the promise after completion
      return manager;
    })();

    return resourceManagerPromise;
  };

  /**
   * Clean up player and its DOM elements properly
   */
  const cleanupPlayer = () => {
    // Stop the main loop
    closing = true;

    const currentPlayer = player();
    if (currentPlayer) {
      currentPlayer.stop();
      setPlayer(null);
    }

    // Clear the content queue
    contentQueue = null;
    fetchedPlaylists = [];

    // Clean up player container DOM
    if (playerContainer) {
      // Remove all child elements properly
      while (playerContainer.firstChild) {
        playerContainer.removeChild(playerContainer.firstChild);
      }
    }
  };

  /**
   * Fetch a single playlist by ID
   */
  const fetchPlaylist = async (
    playlistId: number
  ): Promise<JsonPlaylist | null> => {
    try {
      const response = await fetch(
        `${props.baseUrl}/dashboard/devices/${props.device.id}/playlists/${playlistId}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch playlist');
      }

      return await response.json();
    } catch (err) {
      console.error(`Error fetching playlist ${playlistId}:`, err);
      return null;
    }
  };

  // Store fetched playlists and channel info for the main loop
  let fetchedPlaylists: { channelName: string; playlist: JsonPlaylist }[] = [];
  let channelIndex = 0;
  let closing = false;
  let contentQueue: Playlist | null = null;

  /**
   * Fetch all active playlists and start the player loop
   * Uses the same architecture as the real device player:
   * - Creates a content queue (Playlist) to hold layers
   * - Uses Layer.fromPlaylist() to create layers from playlists
   * - Main loop adds layers to queue when needed and cycles through channels
   */
  const loadPlaylists = async (
    playlists: { channelName: string; playlistId: number }[]
  ) => {
    try {
      // Clean up existing player FIRST before setting up new state
      cleanupPlayer();

      // Fetch all playlists in parallel
      const playlistPromises = playlists.map(async (p) => {
        const playlist = await fetchPlaylist(p.playlistId);
        return playlist ? { channelName: p.channelName, playlist } : null;
      });
      const playlistResults = await Promise.all(playlistPromises);

      // Filter out any failed fetches
      fetchedPlaylists = playlistResults.filter(
        (p): p is { channelName: string; playlist: JsonPlaylist } => p !== null
      );

      if (fetchedPlaylists.length === 0) {
        setError(t('devices.preview.errorLoadingPlaylist'));
        return;
      }

      const channelNames = fetchedPlaylists
        .map((p) => p.channelName)
        .join(', ');
      const playlistNames = fetchedPlaylists
        .map((p) => p.playlist.name || 'Unnamed')
        .join(', ');

      setCurrentChannelName(channelNames);
      setCurrentPlaylistName(playlistNames);

      if (!playerContainer) {
        console.error('Player container not available');
        setError(t('devices.preview.errorLoadingPlaylist'));
        return;
      }

      // Get or create resource manager (reuse if already initialized)
      const manager = await initializeResourceManager();

      // Create a content queue (empty playlist) - same as the real device
      contentQueue = new Playlist('content-queue', manager);

      // Create renderer and player with the content queue
      const renderer = new Renderer(playerContainer);
      const newPlayer = new Player(contentQueue, renderer);
      setPlayer(newPlayer);

      // Start the main loop - same pattern as the real device
      channelIndex = 0;
      closing = false;
      runMainLoop(manager, newPlayer);
    } catch (err) {
      console.error('Error loading playlists:', err);
      setError(t('devices.preview.errorLoadingPlaylist'));
    }
  };

  /**
   * Main loop that cycles through channels - same as the real device player.
   * Adds content to the queue when it has less than 2 items, cycles through channels.
   */
  const runMainLoop = async (
    manager: ResourceManager,
    currentPlayer: Player
  ) => {
    try {
      while (!closing) {
        // Add next content when queue is running low
        if (
          contentQueue &&
          contentQueue.length < 2 &&
          fetchedPlaylists.length > 0
        ) {
          const currentPlaylist = fetchedPlaylists[channelIndex];

          // Create a layer from the playlist - same as the real device
          // Use muted: true for browser preview to allow autoplay
          const layer = Layer.fromPlaylist(currentPlaylist.playlist, manager, {
            target: 'poster',
            muted: true,
          });

          // Add layer to the content queue
          contentQueue.add(layer);

          // Start playing if not already
          currentPlayer.play({ loop: true });

          // Set up end handler to remove layer from queue - same as the real device
          const onEnd = () => {
            contentQueue?.remove(layer);
            layer.off('end', onEnd);
          };
          layer.on('end', onEnd);

          // Move to next channel
          channelIndex = (channelIndex + 1) % fetchedPlaylists.length;
        }

        // Wait before next iteration - same as the real device (5 seconds)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.error('Error in preview main loop:', err);
    }
  };

  /**
   * Initialize the preview
   */
  onMount(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch channels assigned to this device
      const channelsResponse = await DevicesService.fetchChannelByDeviceId(
        props.baseUrl,
        props.device.id
      );

      setChannels(channelsResponse.data || []);

      // Determine all playlists that should be playing from all channels
      const activePlaylists = determineCurrentPlaylists();

      if (activePlaylists.length > 0) {
        // Use the first playlist ID for the signal (for conditional rendering)
        setCurrentPlaylistId(activePlaylists[0].playlistId);
        // Set loading to false first so the container is rendered
        setLoading(false);
        // Use requestAnimationFrame to ensure the DOM has updated
        requestAnimationFrame(() => {
          loadPlaylists(activePlaylists);
        });
      } else {
        setError(t('devices.preview.noScheduledContent'));
        setLoading(false);
      }
    } catch (err) {
      console.error('Error initializing preview:', err);
      setError(t('devices.preview.errorInitializing'));
      setLoading(false);
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    cleanupPlayer();
  });

  return (
    <div class={styles.devicePreview}>
      <Show when={loading()}>
        <div class={styles.previewLoading}>
          <p>{t('common.loading')}</p>
        </div>
      </Show>

      <Show when={!loading() && error()}>
        <div class={styles.previewError}>
          <p>{error()}</p>
        </div>
      </Show>

      <Show when={!loading() && !error() && currentPlaylistId()}>
        <div class={styles.previewInfo}>
          <p>
            <strong>{t('devices.preview.currentlyPlaying')}:</strong>{' '}
            {currentChannelName()}
          </p>
          <p>
            <strong>{t('common.playlist')}:</strong> {currentPlaylistName()}
          </p>
          <p class={styles.previewNote}>{t('devices.preview.note')}</p>
        </div>
        <div class={styles.previewContainer} ref={playerContainer}></div>
      </Show>
    </div>
  );
};
