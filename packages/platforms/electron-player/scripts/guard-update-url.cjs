"use strict";

const updateUrl = globalThis.process.env.CASTMILL_UPDATE_URL;

if (!updateUrl || !updateUrl.trim()) {
  globalThis.console.error(
    "CASTMILL_UPDATE_URL is required for electron-builder. Example: CASTMILL_UPDATE_URL=https://updates.castmill.dev/electron",
  );
  globalThis.process.exit(1);
}
