import { Socket, Channel } from 'phoenix';
import { ILogger, LogLevel } from './logger';

export class WebSocketLogger implements ILogger {
  private channel: Channel;

  constructor(socket: Socket, deviceId: string) {
    // Create and join the channel
    const channelTopic = `device_telemetry:${deviceId}`;
    this.channel = socket.channel(channelTopic);
    this.channel
      .join()
      .receive('ok', () =>
        console.log(`Joined channel successfully: ${channelTopic}`)
      )
      .receive('error', (reasons) =>
        console.error(`Failed to join channel: ${reasons}`)
      )
      .receive('timeout', () =>
        console.error('Networking issue. Still waiting...')
      );
  }

  async log(level: LogLevel, message: string): Promise<void> {
    // Push the log message to the Phoenix channel
    this.channel
      .push('log', {
        message: message,
        level: level,
        timestamp: new Date().toISOString(),
      })
      .receive('ok', (resp) => console.log('Message received:', resp))
      .receive('error', (reasons) =>
        console.error('Failed to push message:', reasons)
      )
      .receive('timeout', () =>
        console.error('Connection interruption while pushing the message.')
      );
  }
}
