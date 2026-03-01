import { useNavigate, useLocation, useParams } from '@solidjs/router';
import {
  Component,
  JSX,
  Show,
  onMount,
  createEffect,
  createSignal,
} from 'solid-js';
import { checkAuth, getUser, loginUser } from './auth'; // Import loginUser
import { AddOn } from '../interfaces/addon.interface';
import { AddonsService } from '../services/addons';
import { store, setStore } from '../store/store';
import { OrganizationsService } from '../services/organizations.service';
import { NetworkService } from '../services/network.service';
import { usePermissions } from '../hooks/usePermissions';
import { ServerError } from './server-error/server-error';
import { OnboardingDialog } from './onboarding-dialog/onboarding-dialog';
import { OnboardingTour } from './onboarding-tour/onboarding-tour';
import { OnboardingService } from '../services/onboarding.service';
import { OnboardingStep } from '../interfaces/onboarding-progress.interface';

import { useI18n } from '../i18n';
import { useToast } from '@castmill/ui-common';
import { baseUrl } from '../env';

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
  const { t, locale, extendTranslations } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const toast = useToast();
  const { loadPermissions } = usePermissions();
  const [serverError, setServerError] = createSignal(false);
  const [showOnboarding, setShowOnboarding] = createSignal(false);
  const [onboardingOrgId, setOnboardingOrgId] = createSignal<string | null>(
    null
  );

  const handleRetry = () => {
    setServerError(false);
    window.location.reload();
  };

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
      try {
        await loginUser();
      } catch (error) {
        if (error instanceof Error && error.message === 'SERVER_UNREACHABLE') {
          setServerError(true);
          return;
        }
        // For other errors, show toast and redirect to login
        toast.error(
          `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        navigate('/login', { replace: true });
        return;
      }

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

        // Check if any organization needs onboarding
        const incompleteOrg = organizations.find(
          (org) => org.onboarding_completed === false
        );

        if (incompleteOrg) {
          // Show onboarding dialog for this organization
          setOnboardingOrgId(incompleteOrg.id);
          setShowOnboarding(true);

          // Still set the organizations in store, but user can't proceed until onboarding is complete
          setStore('organizations', {
            data: organizations,
            loaded: true,
            loading: false,
            selectedId: incompleteOrg.id,
            selectedName: incompleteOrg.name,
          });
          return;
        }

        // Determine which organization to select
        const urlOrgId = params.orgId;
        let selectedOrg = organizations.find((org) => org.id === urlOrgId);

        // If URL org ID doesn't exist in user's organizations, use first one
        if (!selectedOrg && organizations.length > 0) {
          selectedOrg = organizations[0];
          // Only redirect if we're on an /org/ route with an invalid org ID
          if (urlOrgId) {
            const currentPath = location.pathname.replace(/^\/org\/[^\/]+/, '');
            navigate(`/org/${selectedOrg.id}${currentPath || '/'}`, {
              replace: true,
            });
          }
        }

        // Set the organizations in the store
        setStore('organizations', {
          data: organizations,
          loaded: true,
          loading: false,
          selectedId: selectedOrg?.id,
          selectedName: selectedOrg?.name,
        });

        // Load network admin status
        loadNetworkAdminStatus();

        // Load public network settings for footer branding
        loadPublicNetworkSettings();
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
    }
  });

  const handleOnboardingComplete = (organizationName: string) => {
    // Update the organization name in the store
    setStore('organizations', 'data', (orgs) =>
      orgs.map((org) =>
        org.id === onboardingOrgId()
          ? { ...org, name: organizationName, onboarding_completed: true }
          : org
      )
    );
    setStore('organizations', 'selectedName', organizationName);

    // Hide the onboarding dialog
    setShowOnboarding(false);
    setOnboardingOrgId(null);

    // Continue loading addons now that onboarding is complete
    loadAddons();
  };

  /**
   * Load public network settings (available to all users).
   * Used for footer branding.
   */
  const loadPublicNetworkSettings = async () => {
    if (store.networkSettings.loaded || store.networkSettings.loading) {
      return;
    }

    setStore('networkSettings', {
      ...store.networkSettings,
      loading: true,
    });

    try {
      const settings = await NetworkService.getPublicSettings();
      setStore('networkSettings', {
        loaded: true,
        loading: false,
        logo: settings.logo || '',
        copyright: settings.copyright || '© 2011-2025 Castmill™',
        email: settings.email || 'support@castmill.com',
        defaultLocale: settings.default_locale || 'en',
        socialLinks: settings.social_links || {},
      });
    } catch (error) {
      console.warn('Failed to load public network settings:', error);
      setStore('networkSettings', {
        loaded: true,
        loading: false,
        logo: '',
        copyright: '© 2011-2025 Castmill™',
        email: 'support@castmill.com',
        defaultLocale: 'en',
        socialLinks: {},
      });
    }
  };

  /**
   * Load network admin status for the current user
   */
  const loadNetworkAdminStatus = async () => {
    if (store.network.loaded || store.network.loading) {
      return;
    }

    setStore('network', {
      ...store.network,
      loading: true,
    });

    try {
      const status = await NetworkService.checkAdminStatus();
      setStore('network', {
        loaded: true,
        loading: false,
        isAdmin: status.is_admin,
        networkId: status.network_id,
        access: status.access,
      });
    } catch (error) {
      console.warn('Failed to load network admin status:', error);
      setStore('network', {
        loaded: true,
        loading: false,
        isAdmin: false,
        networkId: null,
      });
    }
  };

  const loadAddons = async () => {
    if (store.addons.length == 0 && !store.loadedAddons) {
      setStore('loadingAddons', true);
      try {
        const loadedAddons = await AddonsService.getAll();

        // Load translations for addons that have them
        await loadAddonTranslations(loadedAddons, locale());

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

    // After addons are loaded, check if we should show the onboarding tour
    loadOnboardingTour();
  };

  /**
   * Load translations for all addons that have a translations_path
   */
  const loadAddonTranslations = async (
    addons: AddOn[],
    currentLocale: string
  ) => {
    const addOnBasePath = `${baseUrl}/assets/addons`;

    for (const addon of addons) {
      if (addon.translations_path) {
        try {
          const translationUrl = `${addOnBasePath}${addon.translations_path}/${currentLocale}.json`;
          const response = await fetch(translationUrl);
          if (response.ok) {
            const translations = await response.json();
            extendTranslations(translations);
          } else {
            // Try loading English as fallback if the current locale is not available
            if (currentLocale !== 'en') {
              const fallbackUrl = `${addOnBasePath}${addon.translations_path}/en.json`;
              const fallbackResponse = await fetch(fallbackUrl);
              if (fallbackResponse.ok) {
                const translations = await fallbackResponse.json();
                extendTranslations(translations);
              }
            }
          }
        } catch (error) {
          console.warn(
            `Failed to load translations for addon ${addon.id}:`,
            error
          );
        }
      }
    }
  };

  const loadOnboardingTour = async () => {
    try {
      const user = getUser();
      if (!user || !user.id) return;

      // Fetch onboarding progress
      const progress = await OnboardingService.getProgress(user.id);

      // Store the progress in global store along with the completeStep helper
      setStore('onboarding', {
        progress,
        showTour: !progress.dismissed && !progress.is_completed,
        completeStep: async (step: OnboardingStep) => {
          try {
            const currentUser = getUser();
            if (!currentUser || !currentUser.id) return;

            // Only complete if not already completed
            const currentProgress = store.onboarding.progress;
            if (
              currentProgress?.completed_steps.includes(step) ||
              currentProgress?.is_completed
            ) {
              return;
            }

            const updatedProgress = await OnboardingService.completeStep(
              currentUser.id,
              step
            );

            // Update the store with new progress
            setStore('onboarding', 'progress', updatedProgress);

            // If all steps are complete, close the tour with a success message
            if (updatedProgress.is_completed) {
              setStore('onboarding', 'showTour', false);
              toast.success(t('onboardingTour.allStepsComplete'));
            }
          } catch (error) {
            // Silently fail - don't interrupt the user's flow
            console.error('Failed to complete onboarding step:', error);
          }
        },
      });
    } catch (error) {
      // Silently fail - onboarding tour is optional
      console.error('Failed to load onboarding progress:', error);
    }
  };

  const handleCloseTour = () => {
    setStore('onboarding', 'showTour', false);
  };

  const handleCompleteTour = () => {
    setStore('onboarding', 'showTour', false);
  };

  // Watch for organizations to be loaded and load addons if onboarding is not needed
  createEffect(() => {
    if (store.organizations.loaded && !showOnboarding()) {
      loadAddons();
    }
  });

  // Reload addon translations when locale changes
  createEffect(() => {
    const currentLocale = locale();
    // Only reload if addons are already loaded
    if (store.loadedAddons && store.addons.length > 0) {
      loadAddonTranslations(store.addons, currentLocale);
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
    <>
      <Show when={serverError()}>
        <ServerError onRetry={handleRetry} />
      </Show>
      <Show when={showOnboarding() && onboardingOrgId()}>
        <OnboardingDialog
          organizationId={onboardingOrgId()!}
          onComplete={handleOnboardingComplete}
        />
      </Show>
      <Show when={store.onboarding.showTour && store.onboarding.progress}>
        <OnboardingTour
          userId={getUser().id!}
          initialProgress={store.onboarding.progress!}
          onClose={handleCloseTour}
          onComplete={handleCompleteTour}
        />
      </Show>
      <Show
        when={!serverError() && !store.loadingAddons && !showOnboarding()}
        fallback={<div style="min-height: 20em;"></div>}
      >
        {props.children(store.addons)}
      </Show>
    </>
  );
};

export default ProtectedRoute;
