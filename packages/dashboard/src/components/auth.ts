import { Socket } from 'phoenix';
import { createSignal } from 'solid-js';
import { setStore } from '../store';

import { baseUrl, wsEndpoint } from '../env';

class User {
  id?: string;
  email?: string;
  name?: string;
}

// Example authentication signal (replace with your actual authentication logic)
const [isAuthenticated, setIsAuthenticated] = createSignal(true);
const [user, setUser] = createSignal<User>({});

/**
 * Establish a user session.
 *
 * When called with `sessionData` (user + token already available from the
 * login POST response), it skips the follow-up GET /sessions/ which relies
 * on session cookies — those are blocked cross-origin (SameSite=Lax).
 *
 * When called without arguments it falls back to GET /sessions/ for
 * same-origin callers that still rely on cookie-based sessions.
 */
export async function loginUser(sessionData?: { user: User; token: string }) {
  try {
    let userData: User;
    let token: string;

    if (sessionData) {
      // Validate required fields before trusting the caller-provided data
      if (
        typeof sessionData.token !== 'string' ||
        sessionData.token === '' ||
        typeof sessionData.user?.id !== 'string' ||
        sessionData.user.id === ''
      ) {
        resetSession();
        return;
      }
      // Use the data returned directly by the login POST (cross-origin safe)
      userData = sessionData.user;
      token = sessionData.token;
    } else {
      // Fallback: fetch from session cookie (same-origin only)
      const result = await fetch(`${baseUrl}/sessions/`, {
        method: 'GET',
        credentials: 'include',
      });

      if (result.status !== 200) {
        resetSession();
        return;
      }

      // TODO: We should refresh the token once per hour, is is specially important
      // if the socket needs to reconnect and therefore the token needs to be fresh
      const json = await result.json();

      if (json.status !== 'ok' || typeof json.user !== 'object') {
        resetSession();
        return;
      }

      // Guard against null user (typeof null === 'object'), missing id, or
      // missing token — any of which would break the socket connection.
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
        // TODO: Set some state icon to show we are online receiving updates
      })
      .receive('error', () => {
        console.log('Unable to join');
        // TODO: Set some state icon to show we are offline
      });

    setStore('socket', socket);
    setUser(userData);
    setIsAuthenticated(true);
  } catch (error) {
    // Handle network errors (e.g., server is down)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('SERVER_UNREACHABLE');
    }
    // Re-throw other errors
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
}
