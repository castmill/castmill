export interface Machine {
  /**
   * Returns the machine's unique identifier.
   *
   * This ID must be unique across all machines. And the call to this
   * method should always return the same value for a given machine.
   *
   * A good way to generate this ID is to use the machine's MAC address.
   * Whatever this method will return it will always be properly hashed before
   * being sent to the server to avoid leaking the machine's ID.
   *
   */
  getMachineGUID(): Promise<string>;

  /**
   *
   * Store the credentials in a secure location on the device.
   *
   * When a device is registered, the server will send back a set of credentials
   * that are necessary for the device to connect to the server and receive
   * content and configuration updates.
   *
   * @param credentials
   *
   */
  storeCredentials(credentials: string): Promise<void>;

  /**
   *  Returns the credentials stored on the device.
   *
   */
  getCredentials(): Promise<string>;

  /**
   * Remove the credentials from the device.
   */
  removeCredentials(): Promise<void>;

  /**
   * Returns the machine's location as a latitude and longitude
   * float numbers.
   */
  getLocation?(): Promise<undefined | {
    latitude: number;
    longitude: number;
  }>;

  /**
   * Returns the machine's timezone identifier as a string.
   * Examples:
   *  "America/New_York"
   *  "Europe/Paris"
   *  "Asia/Tokyo"
   *  "Australia/Sydney"
   *  "Pacific/Auckland"
   */
  getTimezone?(): Promise<string>;

  /**
   * Reset the device application.
   */
  reset?(): Promise<void>;

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  reboot?(): Promise<void>;

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  shutdown?(): Promise<void>;

  /**
   * Updates the device's application.
   */
  update?(): Promise<void>;

  /**
   * Updates the device's firmware.
   */
  updateFirmware?(): Promise<void>;
}
