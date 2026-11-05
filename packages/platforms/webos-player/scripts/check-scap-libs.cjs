#!/usr/bin/env node
// Fails the build/packaging when the LG SCAP libraries are missing.
// Set WEBOS_ALLOW_MISSING_SCAP=1 to only warn (used by monorepo-wide builds
// that do not produce an IPK).
// They are downloaded separately (see README "Install the SCAP API libraries");
// without them the IPK starts but SCAP constructors such as DeviceInfo are
// undefined on the display.
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const root = process.argv[2] || 'dist';
// public/ is copied to the root of dist/, so both layouts share these paths.
const common = [
  'configuration.js',
  'deviceInfo.js',
  'inputSource.js',
  'power.js',
  'signage.js',
  'sound.js',
  'storage.js',
  'video.js',
  'security.js',
  'time.js',
  'utility.js',
];
const required = [
  'lib/custom.js',
  'lib/scap-loader.js',
  'lib/scap_1.7/cordova/2.7.0/cordova.webos.js',
  ...common.map((file) => `lib/scap_1.5/cordova-cd/${file}`),
  ...[...common, 'iot.js'].map((file) => `lib/scap_1.7/cordova-cd/${file}`),
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length) {
  const allow = process.env.WEBOS_ALLOW_MISSING_SCAP === '1';
  const log = allow ? console.warn : console.error;
  log(`${allow ? 'Warning: m' : 'M'}issing SCAP files in ${root}/:`);
  for (const file of missing) log(`  ${file}`);
  log(
    'Install the SCAP 1.5 and 1.7 libraries into public/lib/ ' +
      '(see README "Install the SCAP API libraries"). Without them the app ' +
      'fails on the display with "DeviceInfo is not defined".'
  );
  if (allow) {
    log(
      'Continuing because WEBOS_ALLOW_MISSING_SCAP=1; do not deploy this build.'
    );
  } else {
    process.exit(1);
  }
} else {
  console.log(`SCAP libraries present in ${root}/`);
}
