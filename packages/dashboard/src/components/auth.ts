import { Socket } from 'phoenix';
import { createSignal } from 'solid-js';
import { setStore } from '../store';

const baseUrl = 'http://localhost:4000';

class User {
  id?: string;
  email?: string;
  name?: string;
}

// Example authentication signal (replace with your actual authentication logic)
const [isAuthenticated, setIsAuthenticated] = createSignal(true);
const [user, setUser] = createSignal<User>({});

// Function to simulate login for demonstration purposes
export async function loginUser() {
  const result = await fetch(`${baseUrl}/sessions/`, {
    method: 'GET',
    credentials: 'include',
  });

  // If status is 200, set isAuthenticated to true
  if (result.status === 200) {
    // TODO: We should refresh the token once per hour, this is specially important
    // if the socket needs to reconnect and therefore the token needs to be fresh
    const { status, user, token } = await result.json();

    // Check if the status is "ok" and if the user is an object
    if (status !== 'ok' || typeof user !== 'object') {
      resetSession();
      return;
    }

    // Start user_socket connection for realtime updates
    const socket = new Socket(`ws:localhost:4000/user_socket`, {
      params: () => ({ token }),
    });
    socket.connect();
    const channel = socket.channel(`users:${user.id}`, {});

    channel.join().receive('ok', () => {
      console.log('Joined successfully');
      // TODO: Set some state icon to show we are online receiving updates
    }).receive('error', () => {
      console.log('Unable to join');
      // TODO: Set some state icon to show we are offline
    });

    setStore('socket', socket);
    setUser(user);
    setIsAuthenticated(true);

  } else {
    resetSession();
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

export function resetSession() {
  setIsAuthenticated(false);
  setUser({});
}
