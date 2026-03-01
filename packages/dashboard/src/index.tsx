/* @refresh reload */
import './index.scss';
import { baseUrl } from './env';

import { render } from 'solid-js/web';
import {
  Router,
  Route,
  RouteSectionProps,
  useSearchParams,
  useNavigate,
  useParams,
  useLocation,
} from '@solidjs/router';

import {
  Component,
  For,
  Suspense,
  lazy,
  ErrorBoundary,
  onMount,
  createEffect,
  Show,
} from 'solid-js';
import ProtectedRoute from './components/protected-route';
import Topbar from './components/topbar/topbar';
import SettingsPage from './pages/settings-page/settings-page';
import Footer from './components/footer/footer';
import SearchPage from './pages/search-page/search-page';
import { ToastProvider, useToast } from '@castmill/ui-common';

import { AddOnTree } from './classes/addon-tree';

import { store, setStore } from './store/store';
import UsagePage from './pages/usage-page/usage-page';
import TeamsPage from './pages/teams-page/teams-page';
import TeamsInvitationPage from './pages/teams-invitations-page/teams-invitations-page';
import OrganizationPage from './pages/organization-page/organization-page';
import OrganizationsInvitationPage from './pages/organization-invitations/organizations-invitations-page';
import ChannelsPage from './pages/channels-page/channels-page';
import TagsPage from './pages/tags-page/tags-page';
import {
  NetworkProvider,
  NetworkOverview,
  NetworkSettings,
  NetworkOrganizations,
  NetworkUsers,
} from './pages/network';
import { I18nProvider, useI18n } from './i18n';
import { KeyboardShortcutsProvider, useKeyboardShortcuts } from './hooks';

const Login = lazy(() => import('./components/login/login'));
const SignUp = lazy(() => import('./components/signup/signup'));
const CompleteRecovery = lazy(
  () => import('./components/login/complete-recovery')
);
const NotFound = lazy(() => import('./components/not-found'));

const root = document.getElementById('root');

const addOnBasePath = `${baseUrl}/assets/addons`;

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?'
  );
}

const EmptyComponent: Component = () => {
  return <div></div>;
};

const LoadingFallback: Component = () => {
  return <div style="min-height: 10em;"></div>;
};

const RootRedirect: Component = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Use createEffect to reactively watch for organizations to load
  createEffect(() => {
    if (store.organizations.data.length > 0) {
      navigate(`/org/${store.organizations.data[0].id}/`, { replace: true });
    }
  });

  return (
    <Show
      when={store.organizations.loaded && store.organizations.data.length === 0}
      fallback={<LoadingFallback />}
    >
      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'center',
          flex: '1',
          padding: '2em',
          'text-align': 'center',
        }}
      >
        <h2>{t('dashboard.noOrganizations.title')}</h2>
        <p style={{ 'max-width': '30em', color: '#666' }}>
          {t('dashboard.noOrganizations.description')}
        </p>
      </div>
    </Show>
  );
};

const App: Component<RouteSectionProps<unknown>> = (props) => {
  const keyboardShortcuts = useKeyboardShortcuts();

  // Inject keyboard shortcuts into store so addons can access them
  onMount(() => {
    setStore('keyboardShortcuts', {
      registerShortcut: keyboardShortcuts.registerShortcut,
      unregisterShortcut: keyboardShortcuts.unregisterShortcut,
      registerShortcutAction: keyboardShortcuts.registerShortcutAction,
      unregisterShortcutAction: keyboardShortcuts.unregisterShortcutAction,
      getShortcuts: keyboardShortcuts.getShortcuts,
      formatShortcut: keyboardShortcuts.formatShortcut,
      isMac: keyboardShortcuts.isMac,
      isMobile: keyboardShortcuts.isMobile,
    });
  });

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', flex: '1' }}>
      <Topbar />
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column' }}>
        {props.children}
      </div>
      <Footer />
    </div>
  );
};

const wrapLazyComponent = (addon: { path: string; name: string }) => {
  return (props: any) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const routeParams = props.routeParams;
    const i18n = useI18n();
    const navigate = useNavigate();
    const location = useLocation();

    // Initial synchronous update of store with i18n functions
    setStore('i18n', {
      t: i18n.t,
      tp: i18n.tp,
      formatDate: i18n.formatDate,
      formatNumber: i18n.formatNumber,
      formatCurrency: i18n.formatCurrency,
      locale: i18n.locale,
      setLocale: i18n.setLocale,
    });

    // Also track locale changes to update store reactively when language changes
    createEffect(() => {
      // Access locale() to create reactive dependency
      const currentLocale = i18n.locale();
      // Update the store when locale changes
      setStore('i18n', {
        t: i18n.t,
        tp: i18n.tp,
        formatDate: i18n.formatDate,
        formatNumber: i18n.formatNumber,
        formatCurrency: i18n.formatCurrency,
        locale: i18n.locale,
        setLocale: i18n.setLocale,
      });
    });

    // Update store with router utilities
    setStore('router', {
      navigate,
    });

    const toast = useToast();

    const LazyComponent = lazy(async () => {
      try {
        return await import(`${addOnBasePath}${addon.path}`);
      } catch (error) {
        console.error(`Failed to load addon module: ${addon.name}`, error);
        toast.error(
          `Failed to load addon "${addon.name}". The module may not be available.`
        );
        // Return a fallback component
        return {
          default: () => (
            <div class="addon-error">
              <h2>{i18n.t('common.addonLoadingError')}</h2>
              <p>
                Failed to load the "{addon.name}" addon. Please contact your
                administrator.
              </p>
            </div>
          ),
        };
      }
    });

    // Create a wrapper component that tracks selectedOrgId and locale reactively
    const ReactiveWrapper: Component = () => {
      // Access selectedOrgId and locale in this component's render to create reactive dependencies
      const orgId = () => store.organizations.selectedId;
      const locale = () => i18n.locale();

      // Create a combined key that changes when org or locale changes
      const componentKey = () => `${orgId()}-${locale()}`;

      // Use key to force remount when org or locale changes
      return (
        <ErrorBoundary
          fallback={(err, reset) => {
            console.error('Addon component error:', err);
            toast.error(`Error in addon "${addon.name}": ${err.message}`);
            return (
              <div class="addon-error">
                <h2>{i18n.t('common.addonError')}</h2>
                <p>
                  An error occurred while rendering the "{addon.name}" addon.
                </p>
                <button onClick={reset}>Retry</button>
              </div>
            );
          }}
        >
          {/* Use For with a single-item array keyed by locale+orgId to force full remount on change */}
          <For each={[componentKey()]}>
            {(key) => (
              <LazyComponent
                {...props}
                store={store}
                selectedOrgId={orgId()}
                params={[searchParams, setSearchParams]}
                routeParams={routeParams}
              />
            )}
          </For>
        </ErrorBoundary>
      );
    };

    return <ReactiveWrapper />;
  };
};

render(() => {
  const Dashboard = lazy(() => import('./components/dashboard/dashboard'));

  return (
    <I18nProvider>
      <KeyboardShortcutsProvider>
        <ToastProvider>
          <Router>
            {/* Routes without App wrapper (no Topbar/Footer) */}
            <Route path="/login" component={Login} />
            <Route path="/signup" component={SignUp} />
            <Route path="/recover-credentials" component={CompleteRecovery} />
            <Route
              path="/invite-organization"
              component={OrganizationsInvitationPage}
            />
            <Route path="/invite" component={TeamsInvitationPage} />

            {/* Routes with App wrapper (Topbar + Footer) */}
            <Route path="/" component={App}>
              <Route
                path="/"
                component={(props: any) => (
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      {(addons) => <RootRedirect />}
                    </ProtectedRoute>
                  </Suspense>
                )}
              />

              <Route
                path="/org/:orgId"
                component={(props: any) => (
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      {(addons) => (
                        <Dashboard {...props} addons={new AddOnTree(addons)} />
                      )}
                    </ProtectedRoute>
                  </Suspense>
                )}
              >
                <Route path="/" component={EmptyComponent} />
                <Route path="settings" component={SettingsPage} />
                <Route path="search" component={SearchPage} />
                <Route path="usage" component={UsagePage} />
                <Route path="teams" component={TeamsPage} />
                <Route path="tags" component={TagsPage} />
                <Route path="organization" component={OrganizationPage} />
                <Route path="channels" component={ChannelsPage} />
                <Route path="invite" component={TeamsInvitationPage} />

                {/* Dynamically generate routes for AddOns */}
                <For each={store.addons}>
                  {(addon) => {
                    if (!addon.mount_path) {
                      return null;
                    }
                    // Wrap component to force remount when orgId changes
                    const KeyedComponent = (props: any) => {
                      const routeParams = useParams();
                      return (
                        <Show when={routeParams.orgId} keyed>
                          {(orgId) => {
                            const Component = wrapLazyComponent(addon);
                            // Pass routeParams from this context where wildcard is available
                            return (
                              <Component
                                {...props}
                                key={orgId}
                                routeParams={routeParams}
                              />
                            );
                          }}
                        </Show>
                      );
                    };

                    return (
                      <Route
                        path={addon.mount_path}
                        component={KeyedComponent}
                      />
                    );
                  }}
                </For>

                <Route path="/*404" component={NotFound} />
              </Route>

              {/* Network admin routes (top-level, not scoped to org) */}
              <Route
                path="/network"
                component={(props: any) => (
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>
                      {(addons) => (
                        <Dashboard {...props} addons={new AddOnTree(addons)} />
                      )}
                    </ProtectedRoute>
                  </Suspense>
                )}
              >
                <Route
                  path="/"
                  component={() => (
                    <NetworkProvider>
                      <NetworkOverview />
                    </NetworkProvider>
                  )}
                />
                <Route
                  path="/settings"
                  component={() => (
                    <NetworkProvider>
                      <NetworkSettings />
                    </NetworkProvider>
                  )}
                />
                <Route
                  path="/organizations"
                  component={() => (
                    <NetworkProvider>
                      <NetworkOrganizations />
                    </NetworkProvider>
                  )}
                />
                <Route
                  path="/users"
                  component={() => (
                    <NetworkProvider>
                      <NetworkUsers />
                    </NetworkProvider>
                  )}
                />

                {/* Dynamically generate routes for network AddOns */}
                <For
                  each={store.addons.filter((a) =>
                    a.mount_point?.startsWith('network.')
                  )}
                >
                  {(addon) => {
                    if (!addon.mount_path) {
                      return null;
                    }
                    const NetworkAddonComponent = (props: any) => {
                      const routeParams = useParams();
                      const Component = wrapLazyComponent(addon);
                      return <Component {...props} routeParams={routeParams} />;
                    };

                    return (
                      <Route
                        path={addon.mount_path}
                        component={NetworkAddonComponent}
                      />
                    );
                  }}
                </For>

                <Route path="/*404" component={NotFound} />
              </Route>

              {/* Catch-all for any unmatched routes at root level */}
              <Route
                path="/*404"
                component={(props: any) => (
                  <Suspense fallback={<LoadingFallback />}>
                    <ProtectedRoute>{(addons) => <NotFound />}</ProtectedRoute>
                  </Suspense>
                )}
              />
            </Route>
          </Router>
        </ToastProvider>
      </KeyboardShortcutsProvider>
    </I18nProvider>
  );
}, root!);
