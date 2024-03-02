import { Channel, Socket } from 'phoenix';
import { Player, Playlist, Renderer, Viewport, Layer } from '@castmill/player';
import { ResourceManager, Cache, StorageIntegration } from '@castmill/cache';
import { Machine, type DeviceInfo } from '../interfaces/machine';
import { getCastmillIntro } from './intro';
import { Calendar, JsonCalendar } from './calendar';
import { Schema, JsonPlaylist, JsonPlaylistItem } from '../interfaces';
import { JsonMedia } from '../interfaces/json-media';

export enum Status {
  Registering = 'registering',
  Login = 'login', // Loggedin?
}

export interface DeviceMessage {
  resource: 'device' | 'calendar' | 'playlist' | 'widget';
  action: 'update' | 'delete';
  data: any;
}

/**
 * Castmill Device
 *
 * A device encapsulates all the logic needed to play content on a given device
 * remotely.
 *
 */
export class Device {
  private closing = false;
  private cache: Cache;
  private resourceManager: ResourceManager;
  private contentQueue: Playlist;
  private player?: Player;
  private calendars: Calendar[] = [];
  private calendarIndex = 0;

  constructor(
    private integration: Machine,
    private storageIntegration: StorageIntegration,
    private opts?: {
      cache?: {
        maxItems?: number;
      };
      viewport: Viewport;
      baseUrl: string;
    }
  ) {
    this.cache = new Cache(
      this.storageIntegration,
      'castmill-device',
      opts?.cache?.maxItems || 1000
    );
    this.resourceManager = new ResourceManager(this.cache);

    this.contentQueue = new Playlist('content-queue', this.resourceManager);

    const intro = getCastmillIntro(this.resourceManager);
    this.contentQueue.add(intro);
  }

  async start(el: HTMLElement) {
    let credentials = await this.integration.getCredentials();
    if (!credentials) {
      throw new Error('Invalid credentials');
    }

    const { device } = JSON.parse(credentials);
    if (!device) {
      throw new Error('Invalid credentials');
    }

    const renderer = new Renderer(el);
    this.player = new Player(this.contentQueue, renderer, this.opts?.viewport);
    // this.player.play({ loop: true });

    /**
     * Since a device can have a lot of calendars associated to it, as well as be subject to play content based on
     * events at any time, we will use a single player instance to play all the content, and a single playlist.
     * The playlist will be handled as a queue of content to be played. When an item of the playlist has been played
     * it will be removed from the playlist and the next item will be played. When only 1 item remains in the playlist,
     * a new item will be scheduled based on the next calendar.
     *
     */

    // Main loop. This loop will run until the device is stopped.s
    while (!this.closing) {
      // Add next batch of items from the next calendar.
      // Play until only one item remains in the playlist or the device is stopped.
      if (this.contentQueue.length < 2) {
        if (this.calendars.length) {
          const calendar = this.calendars[this.calendarIndex];
          const entry = calendar.getPlaylistAt(Date.now());
          if (entry) {
            const jsonPlaylist: JsonPlaylist | void =
              await this.resourceManager.getData(
                `${this.opts?.baseUrl || ''}devices/${device.id}/playlists/${
                  entry.playlist
                }`,
                1000
              );

            if (jsonPlaylist) {
              const medias = this.getPlaylistMedias(jsonPlaylist);
              await this.cacheMedias(medias);
              const layer = await Layer.fromPlaylist(
                jsonPlaylist,
                this.resourceManager,
                {
                  target: 'default',
                }
              );
              this.contentQueue.add(layer);

              this.player.play({ loop: true });

              const onEnd = () => {
                this.contentQueue.remove(layer);
                layer.off('end', onEnd);
              };

              layer.on('end', onEnd);
            }
          }

          // TODO: If there is no entry we should try with the next calendar instead of
          // waiting for the next loop iteration.
          this.calendarIndex = (this.calendarIndex + 1) % this.calendars.length;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  async stop() {
    this.closing = true;
    await this.player?.stop();
    this.player = undefined;
  }

  async hasCredentials(): Promise<boolean> {
    return !!(await this.integration.getCredentials());
  }

  // TODO: We shall get medias both from options and from the data.
  // TODO: If the widget includes a playlist, we shall get the medias from the playlist recursively.
  private getWidgetMedias(
    schema: Schema,
    data: { [index: string]: any },
    opts: { context: string } = { context: 'default' }
  ): string[] {
    const str = 'medias|type:image';
    const regex = /([^|]+)\|([^|]+)/; // A regular expression to capture two groups separated by a pipe character

    // Find all the keys in the schema that are references to media.
    const mediaKeys = Object.keys(schema).filter((key) => {
      const field = schema[key];
      if (typeof field !== 'string' && field.type === 'ref') {
        const match = field.collection.match(regex);
        if (match) {
          const [, collection, filter] = match;
          return collection === 'medias';
        }
      }
    });

    // For each media key, get the media from the data, and specifically the file url for the given context.
    return mediaKeys
      .map((key) => {
        // We can assume that the data matches the schema and that the media is a valid reference.
        const media = data[key] as JsonMedia;

        const file = media?.files[opts.context];
        return file?.uri;
      })
      .filter((uri) => typeof uri !== 'undefined') as string[];
  }

  private getPlaylistMedias(playlist: JsonPlaylist) {
    const medias = playlist.items.reduce(
      (acc: string[], item: JsonPlaylistItem) => {
        const widget = item.widget;
        const config = item.config;

        if (widget.options_schema) {
          const widgetMedias = this.getWidgetMedias(
            widget.options_schema,
            config.options
          );
          return [...acc, ...widgetMedias];
        } else {
          return acc;
        }
      },
      []
    );

    return medias;
  }

  private cacheMedias(medias: string[]) {
    return Promise.all(
      medias.map((url) => this.resourceManager.cacheMedia(url))
    );
  }

  private async requestPincode(hardwareId: string) {
    const location = await this.integration.getLocation!();
    const pincodeResponse = await fetch('/registrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hardware_id: hardwareId,
        location,
        timezone: await this.integration.getTimezone!(),
      }),
    });

    if (pincodeResponse.status === 201) {
      const { data } = await pincodeResponse.json();
      return data.pincode;
    } else {
      throw new Error(`Invalid status ${pincodeResponse.status}`);
    }
  }

  async loginOrRegister(): Promise<{ status: Status; pincode?: string }> {
    // Get the hardware id of this device.
    const hardwareId = await this.integration.getMachineGUID();

    // Check if this device is registered by getting the credentials from the local storage (if they exist).
    let credentials = await this.integration.getCredentials();

    if (credentials) {
      const { device } = JSON.parse(credentials);

      const channel = await this.login(credentials, hardwareId);
      this.initListeners(channel);

      const rawCalendars = await this.resourceManager.getData(
        `${this.opts?.baseUrl || ''}/devices/${device.id}/calendars`,
        1000
      );

      this.calendars = (rawCalendars?.data || []).map(
        (calendar: JsonCalendar) => new Calendar(calendar)
      );

      return { status: Status.Login };
    } else {
      const pincode = await this.register(hardwareId);
      return { status: Status.Registering, pincode };
    }
  }

  get socketEndpoint() {
    return `${this.opts?.baseUrl || ''}/socket`;
  }

  async register(hardwareId: string) {
    const pincode = await this.requestPincode(hardwareId);

    let socket = new Socket(`/socket`, {
      params: { token: pincode },
    });

    socket.connect();

    // Join the channel to listen for the device to be registered.
    let channel = socket.channel(`register:${hardwareId}`, {
      pincode,
    });
    channel
      .join()
      .receive('ok', (resp) => {
        // Do not show the pincode until this is done
        console.log('Joined successfully', resp);
      })
      .receive('error', (resp) => {
        // TODO: Show error in UI.
        console.log('Unable to join', resp);
      });

    channel.on('device:registered', async (payload) => {
      console.log('Device registered', payload);

      // Store token in local storage as credentials.
      await this.integration.storeCredentials!(JSON.stringify(payload));

      // Refresh the page to initialize the player with the new credentials.
      window.location.reload();
    });

    return pincode;
  }

  async login(credentials: string, hardwareId: string) {
    const { device } = JSON.parse(credentials);

    const socket = new Socket(`/socket`, {
      params: { device_id: device.id, hardware_id: hardwareId },
    });

    socket.connect();

    // Join the channel to establish a communication channel between the server and this device.
    const channel = socket.channel(`devices:${device.id}`, {
      token: device.token,
    });

    return new Promise<Channel>((resolve, reject) => {
      channel
        .join()
        .receive('ok', (resp) => {
          resolve(channel);
        })
        .receive('error', (resp) => {
          reject(resp);
        });
    });
  }

  private initListeners(channel: Channel) {
    channel.on('update', async (payload: DeviceMessage) => {
      switch (payload.resource) {
        case 'device':
          break;
        case 'calendar':
          // We could just mark the calendar as dirty (in the resource manager), as we do not know
          // when the calendar would be used.
          break;
        case 'playlist':
          // We could mark the playlist as dirty (in the resource manager), as we do not know
          // when or even if the playlist will be used.
          break;
        case 'widget':
          break;
      }

      console.log('Update calendars', payload);
    });
  }

  getIntegration() {
    return this.integration;
  }
}

/*
  private async sendCommand(
    channel: Channel,
    command: string,
    payload: any = {}
  ) {
    return new Promise((resolve, reject) => {
      channel
        .push(command, {
          device_id: this.integration.getMachineGUID(),
          ...payload,
        })
        .receive("ok", (payload) => resolve(payload))
        .receive("error", (payload) => reject(payload));
    });
  }
  */
