/**
 * Device bootstrapping.
 * 
 * (c) 2011-2023 Castmill AB All Rights Reserved.
 * 
 */
import { StorageBrowser } from "@castmill/cache";
import { mountDevice, Device, BrowserMachine } from "@castmill/device";

const machineBrowser = new BrowserMachine();
const browserCache = new StorageBrowser("browser-cache");
const device = new Device(machineBrowser, browserCache);

mountDevice(document.getElementById("device"), device);
