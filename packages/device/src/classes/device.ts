import { Socket } from "phoenix";
import { Player, Playlist, Renderer, Viewport } from "@castmill/player";
import { Machine } from "../interfaces/machine";
import { ResourceManager, Cache, StorageIntegration } from "@castmill/cache";
import { getCastmillIntro } from "./intro";

export enum Status {
  Registering = "registering",
  Login = "login",
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

  constructor(
    private integration: Machine,
    private storageIntegration: StorageIntegration,
    private opts?: {
      cache?: {
        maxItems?: number;
      };
      viewport: Viewport;
    }
  ) {
    this.cache = new Cache(
      this.storageIntegration,
      "castmill-device",
      opts?.cache?.maxItems || 1000
    );
    this.resourceManager = new ResourceManager(this.cache);

    this.contentQueue = new Playlist("content-queue", this.resourceManager);

    const intro = getCastmillIntro(this.resourceManager);
    this.contentQueue.add(intro);
  }

  async start(el: HTMLElement) {
    const renderer = new Renderer(el);
    this.player = new Player(this.contentQueue, renderer, this.opts?.viewport);
    this.player.play({ loop: true });

    /**
     * Since a device can have a lot of calendars associated to it, as well as be subject to play content based on
     * events at any time, we will use a single player instance to play all the content, and a single playlist.
     * The playlist will be handled as a queue of content to be played. When an item of the playlist has been played
     * it will be removed from the playlist and the next item will be played. When only 1 item remains in the playlist,
     * a new batch of items will be scheduled based on the next calendar.
     */

    // Main loop. This loop will run until the device is stopped.
    while (!this.closing) {
      // Add next batch of items from the next calendar.
      // Play until only one item remains in the playlist or the device is stopped.
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

  private async requestPincode(hardwareId: string) {
    const location = await this.integration.getLocation!();
    const pincodeResponse = await fetch("/registrations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      this.login(credentials, hardwareId);
      return { status: Status.Login };
    } else {
      const pincode = await this.register(hardwareId);
      return { status: Status.Registering, pincode };
    }
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
      .receive("ok", (resp) => {
        // Do not show the pincode until this is done
        console.log("Joined successfully", resp);
      })
      .receive("error", (resp) => {
        // TODO: Show error in UI.
        console.log("Unable to join", resp);
      });

    channel.on("device:registered", async (payload) => {
      console.log("Device registered", payload);

      // Store token in local storage as credentials.
      await this.integration.storeCredentials!(JSON.stringify(payload));

      // Refresh the page to initialize the player with the new credentials.
      window.location.reload();
    });

    return pincode;
  }

  async login(credentials: string, hardwareId: string) {
    const { device } = JSON.parse(credentials);

    let socket = new Socket(`/socket`, {
      params: { device_id: device.id, hardware_id: hardwareId },
    });

    socket.connect();

    // Join the channel to listen for the device to be registered.
    let channel = socket.channel(`devices:${device.id}`, {
      token: device.token,
    });
    channel
      .join()
      .receive("ok", (resp) => {
        // Do not show the pincode until this is done
        console.log("Joined successfully", resp);
      })
      .receive("error", (resp) => {
        // TODO: Show error in UI.
        console.log("Unable to join", resp);
      });

    // TODO: Implement a communication protocol to get the resources from the server.
    // react to commands sent from the server, and send back information about the device.
    channel.on("update:calendars", async (payload) => {
      console.log("Update calendars", payload);
    });

    channel
      .push("req:get:calendars", { device_id: device.id })
      .receive("ok", (payload) => console.log("Calendars updated", payload));
  }
}
