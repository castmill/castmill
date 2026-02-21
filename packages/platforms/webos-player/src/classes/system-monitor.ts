import { signage } from '../native';

/**
 * System Monitor for webOS SCAP devices.
 *
 * Uses registerSystemMonitor to track temperature and fan status
 * since getTemperature and getFanStatus are not available in all SCAP versions.
 */

export interface TemperatureData {
  temperature: number;
}

export interface FanData {
  fanStatus: Array<{
    name?: string;
    rpm?: number;
    status?: string;
  }>;
}

export interface SystemMonitorData {
  temperature: TemperatureData | null;
  fan: FanData | null;
}

class SystemMonitor {
  private isRunning = false;
  private latestData: SystemMonitorData = {
    temperature: null,
    fan: null,
  };

  /**
   * Start monitoring system parameters (temperature, fan, etc.)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const eventHandler = (event: SystemMonitorEvent) => {
      console.log(
        `[SystemMonitor] Event from ${event.source}: ${event.type}`,
        event.data
      );

      switch (event.type) {
        case 'CURRENT_TEMPERATURE':
          if (event.data.temperature !== undefined) {
            this.latestData.temperature = {
              temperature: event.data.temperature,
            };
          }
          break;
        case 'FAN_STATUS':
          // Fan status comes in event.data with status field
          if (event.data.status !== undefined) {
            this.latestData.fan = {
              fanStatus: [{ status: event.data.status }],
            };
          }
          break;
        // Other event types can be handled here if needed
      }
    };

    const options: SystemMonitorOptions = {
      monitorConfiguration: {
        fan: true,
        lamp: false,
        screen: false,
        signal: false,
        temperature: true,
      },
      eventHandler,
    };

    try {
      await signage.registerSystemMonitor(options);
      this.isRunning = true;
      console.log('[SystemMonitor] Successfully started');
    } catch (error) {
      console.error('[SystemMonitor] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring system parameters
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await signage.unregisterSystemMonitor();
      this.isRunning = false;
      console.log('[SystemMonitor] Successfully stopped');
    } catch (error) {
      console.error('[SystemMonitor] Failed to stop:', error);
      throw error;
    }
  }

  /**
   * Get the latest temperature data
   */
  getTemperature(): TemperatureData | null {
    return this.latestData.temperature;
  }

  /**
   * Get the latest fan status data
   */
  getFanStatus(): FanData | null {
    return this.latestData.fan;
  }

  /**
   * Check if the monitor is currently running
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }
}

// Export a singleton instance
export const systemMonitor = new SystemMonitor();
