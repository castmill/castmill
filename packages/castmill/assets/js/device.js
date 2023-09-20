/**
 * Device bootstrapping.
 *
 * (c) 2011-2023 Castmill AB All Rights Reserved.
 *
 */
import { StorageBrowser } from "@castmill/cache";
import { mountDevice, Device, BrowserMachine } from "@castmill/device";

(async () => {
  const machineBrowser = new BrowserMachine();
  const browserCache = new StorageBrowser("browser-cache", "/assets/");
  const device = new Device(machineBrowser, browserCache);

  await browserCache.init();
  mountDevice(document.getElementById("device"), device);
})();
