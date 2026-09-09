/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TYPE: string;
  readonly VITE_KIOSK: string;
  readonly VITE_FULLSCREEN: string;
  /** Google API key for Chromium geolocation. Enable the Geolocation API in Google Cloud Console. */
  readonly VITE_GOOGLE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
