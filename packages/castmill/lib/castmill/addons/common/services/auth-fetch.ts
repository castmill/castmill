// Auth token key shared with the dashboard (packages/dashboard/src/components/auth.ts)
const AUTH_TOKEN_KEY = 'castmill_auth_token';

/**
 * Fetch wrapper that adds Bearer token when available.
 * Reads the token from localStorage (same key the dashboard writes to).
 * All addon services should use this instead of raw fetch().
 */
export function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    const headers = new Headers(init?.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
  }
  return fetch(input, init ?? {});
}
