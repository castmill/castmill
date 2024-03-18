/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TYPE: string;
  readonly VITE_KIOSK: string;
  readonly VITE_FULLSCREEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
