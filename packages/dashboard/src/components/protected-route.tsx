import { useNavigate, useLocation } from "@solidjs/router";
import { Component, JSX, onMount } from "solid-js";
import { checkAuth } from "./auth"; // Import your authentication check function

// Define the props type to include children
interface ProtectedRouteProps {
  children: JSX.Element; // Use JSX.Element for children
}

const ProtectedRoute: Component<ProtectedRouteProps> = (
  props: ProtectedRouteProps
) => {
  const navigate = useNavigate();
  const location = useLocation();

  onMount(() => {
    if (!checkAuth()) {
      // Redirect to login page if not authenticated
      navigate("/login", { replace: true, state: { from: location.pathname } });
    }
  });

  // Render props.children if authenticated, otherwise null (while redirecting)
  return checkAuth() ? props.children : null;
};

export default ProtectedRoute;
