export interface CastmillPlugin {
  /**
   * Restart the Castmill application.
   */
  restart(): Promise<void>;

  /**
   * Reboot the device.
   */
  reboot(): Promise<void>;

  /**
   * Quit the Castmill application.
   */
  quit(): Promise<void>;

  /**
   * Get current screen brightness level (0-100).
   */
  getBrightness(): Promise<{ brightness: number }>;

  /**
   * Set screen brightness level (0-100).
   */
  setBrightness(options: { brightness: number }): Promise<void>;
}
