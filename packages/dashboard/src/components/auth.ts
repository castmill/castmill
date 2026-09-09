import { Socket } from 'phoenix';
import { createSignal } from 'solid-js';
import { setStore } from '../store';

import { baseUrl, wsEndpoint } from '../env';

class User {
  id?: string;
  email?: string;
  name?: string;
}

const AUTH_TOKEN_KEY = 'castmill_auth_token';

// Example authentication signal (replace with your actual authentication logic)
const [isAuthenticated, setIsAuthenticated] = createSignal(true);
const [user, setUser] = createSignal<User>({});

// Bearer token for API calls.  Persisted in localStorage so it survives
// page refreshes (Phoenix.Token has 24 h server-side expiry).
let authToken: string | null = localStorage.getItem(AUTH_TOKEN_KEY);

/**
 * Returns the current auth token, or null if not authenticated.
 */
export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Fetch wrapper that automatically adds the Bearer Authorization header
 * when an auth token is available.
 *
 * All dashboard service calls should use this instead of raw `fetch()`.
 */
export function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (authToken) {
    const headers = new Headers(init?.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    return fetch(input, { ...init, headers });
  }
  return fetch(input, init ?? {});
}

// Make authFetch available on the global store so addon components can
// use `props.store.authFetch()` instead of raw `fetch()`.
setStore('authFetch', authFetch);

/**
 * Establish a user session.
 *
 * When called with `sessionData` (user + token from a login/recovery POST),
 * uses those values directly.
 *
 * When called without arguments, tries to restore the session from the
 * token stored in localStorage by calling GET /sessions/ with Bearer auth.
 */
export async function loginUser(sessionData?: { user: User; token: string }) {
  try {
    let userData: User;
    let token: string;

    if (sessionData) {
      // Validate required fields
      if (
        typeof sessionData.token !== 'string' ||
        sessionData.token === '' ||
        typeof sessionData.user?.id !== 'string' ||
        sessionData.user.id === ''
      ) {
        resetSession();
        return;
      }
      userData = sessionData.user;
      token = sessionData.token;
    } else {
      // Restore session from stored token via GET /sessions/
      if (!authToken) {
        resetSession();
        return;
      }

      const result = await authFetch(`${baseUrl}/sessions/`, {
        method: 'GET',
      });

      if (result.status !== 200) {
        resetSession();
        return;
      }

      const json = await result.json();

      if (json.status !== 'ok' || typeof json.user !== 'object') {
        resetSession();
        return;
      }

      if (
        json.user == null ||
        typeof json.user.id !== 'string' ||
        json.user.id === '' ||
        typeof json.token !== 'string' ||
        json.token === ''
      ) {
        resetSession();
        return;
      }

      userData = json.user;
      token = json.token;
    }

    // Persist the token
    authToken = token;
    localStorage.setItem(AUTH_TOKEN_KEY, token);

    // Start user_socket connection for realtime updates
    const socket = new Socket(`${wsEndpoint}/user_socket`, {
      params: () => ({ token }),
    });
    socket.connect();
    const channel = socket.channel(`users:${userData.id}`, {});

    channel
      .join()
      .receive('ok', () => {
        console.log('Joined successfully');
      })
      .receive('error', () => {
        console.log('Unable to join');
      });

    setStore('socket', socket);
    setUser(userData);
    setIsAuthenticated(true);
  } catch (error) {
    // Handle network errors (e.g., server is down)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('SERVER_UNREACHABLE');
    }
    throw error;
  }
}

// Function to check if the user is authenticated
export function checkAuth() {
  return isAuthenticated();
}

export function setAuthenticated(value: boolean) {
  setIsAuthenticated(value);
}

export function getUser() {
  return user();
}

export function updateUser(updates: Partial<User>) {
  setUser({ ...user(), ...updates });
}

export function resetSession() {
  setIsAuthenticated(false);
  setUser({});
  authToken = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
