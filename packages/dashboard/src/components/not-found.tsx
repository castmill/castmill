import { Component, Show } from 'solid-js';
import { checkAuth } from './auth';
import { useLocation, useNavigate } from '@solidjs/router';
import { store, setStore } from '../store/store';

const NotFound: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!checkAuth()) {
    // Construct the redirect URL with the current path
    const redirectUrl = `/login?redirectTo=${encodeURIComponent(location.pathname)}`;

    // Redirect to login page if not authenticated
    navigate(redirectUrl, {
      replace: true,
      state: { from: location.pathname },
    });
  } else {
    // Wait for the addons to load
  }

  return (
    <Show when={!store.loadingAddons} fallback={<div>Loading addons...</div>}>
      <div>
        <h1>404 Not Found</h1>
        <h2>Sorry, the page you are looking for does not exist.</h2>
      </div>
    </Show>
  );
};

export default NotFound;
