import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { is } from "@electron-toolkit/utils";
import { app } from "electron";
import { exec } from "child_process";
import { createHash } from "crypto";

const osMock = {
  totalmem: vi.fn(),
  freemem: vi.fn(),
  loadavg: vi.fn(),
  uptime: vi.fn(),
  networkInterfaces: vi.fn(),
};

const siMock = {
  currentLoad: vi.fn(),
  fsSize: vi.fn(),
  cpuTemperature: vi.fn(),
  wifiNetworks: vi.fn(),
  battery: vi.fn(),
};

const mockOne = vi.fn();

const updateHandlers: Record<string, () => void> = {};

const mockAutoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn((event: string, handler: () => void) => {
    updateHandlers[event] = handler;
  }),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
};

vi.mock("electron-updater", () => ({
  autoUpdater: mockAutoUpdater,
}));

vi.mock("@electron-toolkit/utils", () => ({
  is: {
    dev: false,
  },
}));

vi.mock("electron", () => ({
  app: {
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
}));

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("macaddress", () => ({
  one: mockOne,
}));

vi.mock("os", () => ({
  default: osMock,
  ...osMock,
}));

vi.mock("systeminformation", () => ({
  default: siMock,
}));

const originalPlatform = process.platform;

const setPlatform = (platform: string) => {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
};

const loadMachineApi = async () => import("../../src/main/api/machine");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  for (const key of Object.keys(updateHandlers)) {
    delete updateHandlers[key];
  }

  mockAutoUpdater.autoDownload = false;
  mockAutoUpdater.autoInstallOnAppQuit = false;
  is.dev = false;

  vi.mocked(exec).mockReset();
  vi.mocked(app.relaunch).mockReset();
  vi.mocked(app.exit).mockReset();
  mockOne.mockReset();

  osMock.totalmem.mockReset();
  osMock.freemem.mockReset();
  osMock.loadavg.mockReset();
  osMock.uptime.mockReset();
  osMock.networkInterfaces.mockReset();

  siMock.currentLoad.mockReset();
  siMock.fsSize.mockReset();
  siMock.cpuTemperature.mockReset();
  siMock.wifiNetworks.mockReset();
  siMock.battery.mockReset();
});

afterEach(() => {
  setPlatform(originalPlatform);
});

describe("main/api/machine update", () => {
  it("should be a no-op in development mode", async () => {
    is.dev = true;
    const { update } = await loadMachineApi();

    await update();

    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
  });

  it("should configure silent updater and check for updates in production", async () => {
    const { update } = await loadMachineApi();

    await update();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();

    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(mockAutoUpdater.on).toHaveBeenCalledTimes(2);
    expect(mockAutoUpdater.on).toHaveBeenCalledWith("update-downloaded", expect.any(Function));
    expect(mockAutoUpdater.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(exec).not.toHaveBeenCalled();
  });

  it("should propagate checkForUpdates failures to caller", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAutoUpdater.checkForUpdates.mockImplementationOnce(async () => {
      throw new Error("update check failed");
    });
    const { update } = await loadMachineApi();

    await expect(update()).rejects.toThrow("update check failed");
    expect(errorSpy).toHaveBeenCalledWith("Failed to check for updates:", expect.any(Error));

    errorSpy.mockRestore();
  });

  it("should trigger quitAndInstall once when update is downloaded", async () => {
    const { update } = await loadMachineApi();

    await update();

    updateHandlers["update-downloaded"]?.();
    updateHandlers["update-downloaded"]?.();

    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it("should not register duplicate updater handlers across multiple updates", async () => {
    const { update } = await loadMachineApi();

    await update();
    await update();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);

    expect(mockAutoUpdater.on).toHaveBeenCalledTimes(2);
  });
});

describe("main/api/machine lifecycle commands", () => {
  it("relaunch should restart the app process", async () => {
    const { relaunch } = await loadMachineApi();

    relaunch();

    expect(app.relaunch).toHaveBeenCalledOnce();
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it("exit should terminate the app process", async () => {
    const { exit } = await loadMachineApi();

    exit();

    expect(app.exit).toHaveBeenCalledWith(0);
  });
});

describe("main/api/machine power commands", () => {
  it("shutdown should show blocked toast in development mode", async () => {
    is.dev = true;
    const { shutdown } = await loadMachineApi();

    shutdown();

    expect(exec).toHaveBeenCalledOnce();
    expect(exec).toHaveBeenCalledWith(expect.stringContaining("Shutdown"));
  });

  it("reboot should show blocked toast in development mode", async () => {
    is.dev = true;
    const { reboot } = await loadMachineApi();

    reboot();

    expect(exec).toHaveBeenCalledOnce();
    expect(exec).toHaveBeenCalledWith(expect.stringContaining("Reboot"));
  });

  it("shutdown should execute OS command in production", async () => {
    is.dev = false;
    setPlatform("linux");
    const { shutdown } = await loadMachineApi();

    shutdown();

    expect(exec).toHaveBeenCalledWith("poweroff");
  });

  it("reboot should execute OS command in production", async () => {
    is.dev = false;
    setPlatform("linux");
    const { reboot } = await loadMachineApi();

    reboot();

    expect(exec).toHaveBeenCalledWith("reboot");
  });

  it("shutdown should throw on unsupported platforms", async () => {
    is.dev = false;
    setPlatform("freebsd");
    const { shutdown } = await loadMachineApi();

    expect(() => shutdown()).toThrow("Unsupported platform");
  });

  it("reboot should throw on unsupported platforms", async () => {
    is.dev = false;
    setPlatform("freebsd");
    const { reboot } = await loadMachineApi();

    expect(() => reboot()).toThrow("Unsupported platform");
  });
});

describe("main/api/machine identifiers and telemetry", () => {
  it("getMachineGUID should return a sha1 hash of mac address", async () => {
    mockOne.mockResolvedValueOnce("aa:bb:cc:dd:ee:ff");
    const { getMachineGUID } = await loadMachineApi();

    const guid = await getMachineGUID();
    const expected = createHash("sha1").update("aa:bb:cc:dd:ee:ff").digest("hex");

    expect(guid).toBe(expected);
  });

  it("getTelemetry should aggregate available system metrics", async () => {
    osMock.totalmem.mockReturnValueOnce(1000);
    osMock.freemem.mockReturnValueOnce(200);
    osMock.loadavg.mockReturnValueOnce([1.111, 2.222, 3.333]);
    osMock.uptime.mockReturnValueOnce(999);
    osMock.networkInterfaces.mockReturnValueOnce({
      wlan0: [
        {
          internal: false,
          family: "IPv4",
          address: "10.0.0.8",
        },
      ],
    });

    siMock.currentLoad.mockResolvedValueOnce({ currentLoad: 12.34 });
    siMock.fsSize.mockResolvedValueOnce([{ mount: "/", size: 5000, used: 1250 }]);
    siMock.cpuTemperature.mockResolvedValueOnce({
      main: 55,
      cores: [54, 56],
    });
    siMock.wifiNetworks.mockResolvedValueOnce([
      { security: "wpa2", signalLevel: -50, ssid: "Castmill WiFi" },
    ]);
    siMock.battery.mockResolvedValueOnce({
      hasBattery: true,
      percent: 88,
      isCharging: true,
    });

    const { getTelemetry } = await loadMachineApi();
    const telemetry = await getTelemetry();

    expect(telemetry.memory).toEqual({ totalBytes: 1000, usedBytes: 800 });
    expect(telemetry.cpuLoadAvg).toEqual({
      one: 1.11,
      five: 2.22,
      fifteen: 3.33,
    });
    expect(telemetry.cpuUsagePercent).toBe(12.3);
    expect(telemetry.uptimeSeconds).toBe(999);
    expect(telemetry.storage).toEqual({ totalBytes: 5000, usedBytes: 1250 });
    expect(telemetry.temperatures).toEqual([
      { label: "CPU", celsius: 55 },
      { label: "Core 0", celsius: 54 },
      { label: "Core 1", celsius: 56 },
    ]);
    expect(telemetry.network).toEqual({
      ipAddress: "10.0.0.8",
      type: "wifi",
      ssid: "Castmill WiFi",
      wifiSignalStrengthPercent: 100,
    });
    expect(telemetry.battery).toEqual({ levelPercent: 88, isCharging: true });
  });

  it("getTelemetry should return partial data when collectors fail", async () => {
    osMock.totalmem.mockImplementationOnce(() => {
      throw new Error("mem unavailable");
    });
    osMock.networkInterfaces.mockImplementationOnce(() => {
      throw new Error("net unavailable");
    });

    siMock.currentLoad.mockRejectedValueOnce(new Error("cpu unavailable"));
    siMock.fsSize.mockRejectedValueOnce(new Error("disk unavailable"));
    siMock.cpuTemperature.mockRejectedValueOnce(new Error("temp unavailable"));
    siMock.battery.mockRejectedValueOnce(new Error("battery unavailable"));

    const { getTelemetry } = await loadMachineApi();
    const telemetry = await getTelemetry();

    expect(telemetry).toEqual({});
  });
});
