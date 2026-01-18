import { Component, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { DevicesService, JsonChannel } from '../services/devices.service';
import { 
  Player, 
  Playlist, 
  Renderer, 
  JsonPlaylist 
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
  const [currentPlaylistId, setCurrentPlaylistId] = createSignal<number | null>(null);
  const [currentPlaylistName, setCurrentPlaylistName] = createSignal<string>('');
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
  const getPlaylistAt = (channel: JsonChannel, timestamp: number): { 
    playlist: number; 
    endTime: number; 
    nextTime: number | undefined 
  } | undefined => {
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
   * Determine which playlist should be playing right now
   */
  const determineCurrentPlaylist = () => {
    const channelList = channels();
    if (channelList.length === 0) {
      setError(t('devices.preview.noChannels'));
      return null;
    }

    const now = Date.now();
    
    // Check each channel to find what should be playing
    for (const channel of channelList) {
      const result = getPlaylistAt(channel, now);
      if (result) {
        setCurrentChannelName(channel.name);
        return result.playlist;
      }
    }

    setError(t('devices.preview.noScheduledContent'));
    return null;
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
    const currentPlayer = player();
    if (currentPlayer) {
      currentPlayer.stop();
      setPlayer(null);
    }
    
    // Clean up player container DOM
    if (playerContainer) {
      // Remove all child elements properly
      while (playerContainer.firstChild) {
        playerContainer.removeChild(playerContainer.firstChild);
      }
    }
  };

  /**
   * Fetch and display the playlist
   */
  const loadPlaylist = async (playlistId: number) => {
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

      const playlistData: JsonPlaylist = await response.json();
      setCurrentPlaylistName(playlistData.name || 'Unnamed Playlist');
      
      if (playerContainer) {
        // Clean up existing player properly
        cleanupPlayer();
        
        // Get or create resource manager (reuse if already initialized)
        const manager = await initializeResourceManager();
        
        // Create a new renderer and player
        const renderer = new Renderer(playerContainer);
        const playlist = Playlist.fromJSON(playlistData, manager, { target: 'preview' });
        const newPlayer = new Player(playlist, renderer);
        
        // Start playing
        newPlayer.play({ loop: true });
        setPlayer(newPlayer);
      }
    } catch (err) {
      console.error('Error loading playlist:', err);
      setError(t('devices.preview.errorLoadingPlaylist'));
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

      // Determine which playlist should be playing
      const playlistId = determineCurrentPlaylist();
      
      if (playlistId) {
        setCurrentPlaylistId(playlistId);
        await loadPlaylist(playlistId);
      }
    } catch (err) {
      console.error('Error initializing preview:', err);
      setError(t('devices.preview.errorInitializing'));
    } finally {
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
            <strong>{t('devices.preview.currentlyPlaying')}:</strong> {currentChannelName()}
          </p>
          <p>
            <strong>{t('common.playlist')}:</strong> {currentPlaylistName()}
          </p>
          <p class={styles.previewNote}>
            {t('devices.preview.note')}
          </p>
        </div>
        <div class={styles.previewContainer} ref={playerContainer}></div>
      </Show>
    </div>
  );
};
