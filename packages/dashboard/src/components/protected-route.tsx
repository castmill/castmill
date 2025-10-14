import { useNavigate, useLocation, useParams } from '@solidjs/router';
import { Component, JSX, Show, onMount, createEffect } from 'solid-js';
import { checkAuth, getUser, loginUser } from './auth'; // Import loginUser
import { AddOn } from '../interfaces/addon.interface';
import { AddonsService } from '../services/addons';
import { store, setStore } from '../store/store';
import { OrganizationsService } from '../services/organizations.service';
import { usePermissions } from '../hooks/usePermissions';

import { useI18n } from '../i18n';
import { useToast } from '@castmill/ui-common';

interface ProtectedRouteProps {
  children: (addons: AddOn[]) => JSX.Element; // children is now a function that accepts the addons array
}

export function buildRedirectUrl(pathname: string, search: string): string {
  const destination = search ? `${pathname}${search}` : pathname;

  if (destination !== '/') {
    return `/login?redirectTo=${encodeURIComponent(destination)}`;
  }
  return '/login';
}

const ProtectedRoute: Component<ProtectedRouteProps> = (
  props: ProtectedRouteProps
) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const toast = useToast();
  const { loadPermissions } = usePermissions();

  onMount(async () => {
    if (!checkAuth()) {
      // Construct the redirect URL with the current path
      const redirectUrl = buildRedirectUrl(location.pathname, location.search);

      // Redirect to login page if not authenticated
      navigate(redirectUrl, {
        replace: true,
        state: { from: location.pathname },
      });
    } else {
      // First, ensure user session is loaded
      await loginUser();

      // Load organizations.
      setStore('organizations', {
        ...store.organizations,
        loading: true,
      });
      try {
        const user = getUser();
        if (!user.id) {
          // User not properly loaded, redirect to login
          navigate('/login', { replace: true });
          return;
        }

        const organizations = await OrganizationsService.getAll(user.id!);

        // Determine which organization to select
        const urlOrgId = params.orgId;
        let selectedOrg = organizations.find((org) => org.id === urlOrgId);

        // If URL org ID doesn't exist in user's organizations, use first one
        if (!selectedOrg && organizations.length > 0) {
          selectedOrg = organizations[0];
          // Redirect to correct org URL
          const currentPath = location.pathname.replace(/^\/org\/[^\/]+/, '');
          navigate(`/org/${selectedOrg.id}${currentPath || '/'}`, {
            replace: true,
          });
        }

        // Set the organizations in the store
        setStore('organizations', {
          data: organizations,
          loaded: true,
          loading: false,
          selectedId: selectedOrg?.id,
          selectedName: selectedOrg?.name,
        });
      } catch (error) {
        toast.error(
          `Failed to load organizations: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setStore('organizations', {
          ...store.organizations,
          loading: false,
        });
      }

      // TODO: If we failed in loading organizations, we should redirect to the login page probably.

      // We need to load the addons at the end as they may need stuff like organizations
      // to be loaded first.
      if (store.addons.length == 0 && !store.loadedAddons) {
        setStore('loadingAddons', true);
        try {
          const loadedAddons = await AddonsService.getAll();

          // Set the addons in the store
          setStore('addons', loadedAddons);
          setStore('loadedAddons', true);
        } catch (error) {
          toast.error(
            `Failed to load addons: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          // Set empty addons array so the app can still function
          setStore('addons', []);
          setStore('loadedAddons', true);
        } finally {
          setStore('loadingAddons', false);
        }
      } else if (!store.loadedAddons) {
        // If addons exist but loadedAddons is false (edge case), set it to true
        setStore('loadedAddons', true);
      }
    }
  });

  // Watch for URL param changes and update store
  createEffect(() => {
    const urlOrgId = params.orgId;
    // Only update if we have organizations loaded and URL org ID is different from store
    if (
      store.organizations.loaded &&
      urlOrgId &&
      urlOrgId !== store.organizations.selectedId
    ) {
      const org = store.organizations.data.find((o) => o.id === urlOrgId);
      if (org) {
        setStore('organizations', {
          selectedId: org.id,
          selectedName: org.name,
        });
      }
    }
  });

  // Load permissions when organization changes
  createEffect(() => {
    const orgId = store.organizations.selectedId;
    if (orgId && store.organizations.loaded) {
      loadPermissions(orgId);
    }
  });

  return (
    <Show
      when={!store.loadingAddons}
      fallback={<div style="min-height: 20em;"></div>}
    >
      {props.children(store.addons)}
    </Show>
  );
};

export default ProtectedRoute;
