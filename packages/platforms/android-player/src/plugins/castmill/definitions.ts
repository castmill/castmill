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
}
