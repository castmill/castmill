import { useNavigate, useLocation } from '@solidjs/router';
import { Component, JSX, Show, onMount } from 'solid-js';
import { checkAuth, getUser } from './auth'; // Import your authentication check function
import { AddOn } from '../interfaces/addon.interface';
import { AddonsService } from '../services/addons';
import { store, setStore } from '../store/store';
import { OrganizationsService } from '../services/organizations';

interface ProtectedRouteProps {
  children: (addons: AddOn[]) => JSX.Element; // children is now a function that accepts the addons array
}

function getRedirectUrl(location: string): string {
  if (location !== '/') {
    return `/login?redirectTo=${encodeURIComponent(location)}`;
  }
  return '/login';
}

const ProtectedRoute: Component<ProtectedRouteProps> = (
  props: ProtectedRouteProps
) => {
  const navigate = useNavigate();
  const location = useLocation();

  onMount(async () => {
    if (!checkAuth()) {
      // Construct the redirect URL with the current path
      const redirectUrl = getRedirectUrl(location.pathname);

      // Redirect to login page if not authenticated
      navigate(redirectUrl, {
        replace: true,
        state: { from: location.pathname },
      });
    } else {
      // Load organizations.
      setStore('organizations', {
        ...store.organizations,
        loading: true,
      });
      try {
        const user = getUser();
        const organizations = await OrganizationsService.getAll(user.id!);

        // Set the organizations in the store
        setStore('organizations', {
          data: organizations,
          loaded: true,
          loading: false,
          selectedId: organizations[0]?.id,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setStore('organizations', {
          ...store.organizations,
          loading: false,
        });
      }

      // TODO: If we failed in loading organizations, we should redirect to the login page probably.

      // We need to load the addons at the end as they may need stuff like organizations
      // to be loaded first.
      console.log('Loading addons...', store.addons);
      if (store.addons.length == 0) {
        setStore('loadingAddons', true);
        try {
          const loadedAddons = await AddonsService.getAll();

          // Set the addons in the store
          setStore('addons', loadedAddons);
        } catch (error) {
          console.error(error);
        } finally {
          setStore('loadingAddons', false);
        }
      }
    }
  });

  return (
    <Show when={!store.loadingAddons} fallback={<div>Loading addons...</div>}>
      {props.children(store.addons)}
    </Show>
  );
};

export default ProtectedRoute;
