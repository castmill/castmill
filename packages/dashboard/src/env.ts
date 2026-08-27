export const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Derive origin and domain from the browser at runtime so the dashboard
// works correctly regardless of which network domain it is accessed from.
// In production a single deployment is served on many custom domains
// (e.g. app.castmill.dev, signage.acmecorp.com, tpd.se).
export const origin =
  typeof window !== 'undefined'
    ? window.location.origin
    : import.meta.env.VITE_ORIGIN || 'http://localhost:3000';

export const domain =
  typeof window !== 'undefined'
    ? window.location.hostname
    : import.meta.env.VITE_DOMAIN || 'localhost';

export const wsEndpoint =
  import.meta.env.VITE_WS_ENDPOINT || 'ws://localhost:4000';
