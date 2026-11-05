# webos-player scripts

- `check-scap-libs.cjs [dir]` verifies that the LG SCAP 1.5/1.7 libraries,
  `cordova.webos.js`, `custom.js`, and `scap-loader.js` exist in `dir`
  (`public` before `yarn build`, `dist` before `yarn package`). Both scripts
  fail when files are missing; run the check directly with
  `yarn check-scap-libs`. With `WEBOS_ALLOW_MISSING_SCAP=1` it only warns. The
  root `build:platforms:webos` (used by `yarn build:all` and the dashboard
  Docker image) sets this because those builds do not produce an IPK.
