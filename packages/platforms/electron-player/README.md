# electron-player

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
# For windows
$ yarn build:win

# For macOS
$ yarn build:mac

# For Linux
$ yarn build:linux
```
