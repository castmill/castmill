'use strict';

const updateUrl = process.env.CASTMILL_UPDATE_URL;

if (!updateUrl || !updateUrl.trim()) {
  console.error(
    'CASTMILL_UPDATE_URL is required for electron-builder. Example: CASTMILL_UPDATE_URL=https://updates.castmill.dev/electron'
  );
  process.exit(1);
}
