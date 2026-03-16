#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function findElectronDir() {
  const packageJsonPath = require.resolve('electron/package.json', {
    paths: [process.cwd()],
  });
  return path.dirname(packageJsonPath);
}

function hasElectronBinary(electronDir) {
  const distDir = path.join(electronDir, 'dist');
  if (!fs.existsSync(distDir)) {
    return false;
  }

  // Keep the check simple and platform agnostic: if dist has files after install,
  // Electron was downloaded and unpacked correctly.
  return fs.readdirSync(distDir).length > 0;
}

function installElectron(electronDir) {
  const installScript = path.join(electronDir, 'install.js');
  if (!fs.existsSync(installScript)) {
    throw new Error(`Missing Electron install script: ${installScript}`);
  }

  console.log('[ensure-electron] Electron binary is missing. Downloading...');
  const result = spawnSync(process.execPath, [installScript], {
    cwd: electronDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_SKIP_BINARY_DOWNLOAD: undefined,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `Electron install failed with exit code ${result.status ?? 'unknown'}`
    );
  }
}

function main() {
  const electronDir = findElectronDir();
  if (hasElectronBinary(electronDir)) {
    return;
  }

  installElectron(electronDir);

  if (!hasElectronBinary(electronDir)) {
    throw new Error('Electron binary still missing after installer run.');
  }

  console.log('[ensure-electron] Electron binary is ready.');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ensure-electron] ${message}`);
  process.exit(1);
}
