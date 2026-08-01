s# electron-player

An Electron application with Solid and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ yarn
```

### Environment Variables

Copy the relevant `.env.*` file and configure the variables. The following environment variables are available:

| Variable              | Description                                                   | Required |
| --------------------- | ------------------------------------------------------------- | -------- |
| `VITE_APP_TYPE`       | Application type identifier (e.g. `Electron`, `Electron-dev`) | Yes      |
| `VITE_KIOSK`          | Enable kiosk mode (`true`/`false`)                            | Yes      |
| `VITE_FULLSCREEN`     | Enable fullscreen mode (`true`/`false`)                       | Yes      |
| `VITE_GOOGLE_API_KEY` | Google API key for geolocation services                       | No\*     |
| `CASTMILL_UPDATE_URL` | Electron auto-update feed URL used at build time              | Yes\*\*  |

#### Auto-update URL (build-time)

The Electron auto-update feed URL is injected at build time via `CASTMILL_UPDATE_URL`.

`CASTMILL_UPDATE_URL` is mandatory for `electron-builder` config.

A guard script (`yarn guard:update-url`) is run by all provided builder scripts to fail fast if it is missing.

Build scripts use plain POSIX environment variable assignment. Windows shells are not supported for these scripts right now.

Defaults:

- Staging builds use `https://updates.castmill.dev/electron`
- Production builds use `https://updates.castmill.io/electron`

The default OS build commands (`build:mac`, `build:linux`) produce **staging** builds.

Use these scripts for explicit targets:

```bash
# Staging
yarn build:staging:mac
yarn build:staging:linux

# Production
yarn build:prod:mac
yarn build:prod:linux
```

You can still override the URL manually by setting `CASTMILL_UPDATE_URL` when invoking the provided build scripts or `electron-builder` directly.

> **Note**:
>
> - The provided build scripts (`build:*`, `build:staging:*`, `build:prod:*`, `build:unpack`) set `CASTMILL_UPDATE_URL` for you.
> - If you invoke `electron-builder` directly, you must set `CASTMILL_UPDATE_URL` yourself and should run `yarn guard:update-url` first.

#### Linux update feed format

For Linux, the update URL must host Electron Updater generic feed metadata and the referenced artifact files.

- Required metadata: `latest-linux.yml`
- Required artifact: the Linux package referenced by the metadata (typically `.AppImage`)
- Optional artifact: `.zsync` (for differential AppImage updates)

At runtime, the updater reads `latest-linux.yml` from the configured base URL and then downloads the file listed in that manifest.

#### Geolocation & Google API Key

Electron does not bundle a Google API key like Chrome does. Without one, Chromium's built-in network location provider cannot authenticate with Google's Geolocation service, and `navigator.geolocation` calls will always time out.

To enable geolocation:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Geolocation API**
3. Create an API key (restrict it to the Geolocation API for security)
4. Set `VITE_GOOGLE_API_KEY` in your `.env.development` or `.env.production` file:
   ```dotenv
   VITE_GOOGLE_API_KEY=your-api-key-here
   ```

The key is injected at build time and passed to Chromium via `process.env.GOOGLE_API_KEY` in the main process. Google's free tier allows 40,000 geolocation calls per month, which is more than sufficient for signage devices that only resolve location at startup.

> **Note**: If `VITE_GOOGLE_API_KEY` is not set, the player will still function normally — geolocation will simply return `undefined` and a warning will be logged at startup.

### Development

```bash
$ yarn dev
```

### Build

```bash
# For macOS
$ yarn build:mac

# For Linux
$ yarn build:linux
```
