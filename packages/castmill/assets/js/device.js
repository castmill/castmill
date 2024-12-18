/**
 * Device bootstrapping.
 *
 * (c) 2011-2024 Castmill AB All Rights Reserved.
 *
 */
import { StorageBrowser } from "@castmill/cache";
import { mountDevice, Device, BrowserMachine } from "@castmill/device";

(async () => {
  const browserMachine = new BrowserMachine();
  const browserCache = new StorageBrowser("browser-cache", "/assets/");
  const device = new Device(browserMachine, browserCache);

  await device.init();
  await browserCache.init();

  mountDevice(document.getElementById("device"), device);
})();
