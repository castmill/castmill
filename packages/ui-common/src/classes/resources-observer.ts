import { Socket, Channel } from 'phoenix';

export class ResourcesObserver<T extends { id: string }> {
  channels: Record<string, Channel> = {};

  constructor(
    private socket: Socket,
    private updateRoom: string,
    /* Called everytime a new resource is added to the list, must return a topic to join to */
    private onJoin: (resource: T) => string,
    private onUpdate: (resource: T, data: any) => void
  ) {}

  observe(resources: T[]) {
    const resourceIds = new Set(resources.map((resource) => resource.id));

    // Clean all the old unused channel subscriptions
    Object.keys(this.channels).forEach((id) => {
      if (!resourceIds.has(id)) {
        const channel = this.channels[id];
        channel.off(this.updateRoom);
        channel.leave();
        delete this.channels[id];
      }
    });

    // Join to every new device channel to get the online status
    resources.forEach((resource) => {
      if (this.channels[resource.id]) {
        return;
      } else {
        const topic = this.onJoin(resource);
        const channel = this.socket.channel(topic);
        this.channels[resource.id] = channel;

        channel.on(this.updateRoom, (data: any) => {
          this.onUpdate(resource, data);
        });

        channel.join();
      }
    });
  }

  cleanup() {
    Object.values(this.channels).forEach((channel) => {
      channel.leave();
    });
  }
}
