import { createSignal } from "solid-js";

const baseUrl = "http://localhost:4000";

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
    method: "GET",
    credentials: "include",
  });

  // If status is 200, set isAuthenticated to true
  if (result.status === 200) {
    setIsAuthenticated(true);
    const { status, user } = await result.json();
    // status should be "ok" and user should be an object
    setUser(user);
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
