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
} from '@solidjs/router';

import {
  Component,
  For,
  Suspense,
  lazy,
  ErrorBoundary,
  onMount,
  createEffect,
  createMemo,
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
import { I18nProvider, useI18n } from './i18n';

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

  // Use createEffect to reactively watch for organizations to load
  createEffect(() => {
    if (store.organizations.data.length > 0) {
      navigate(`/org/${store.organizations.data[0].id}/`, { replace: true });
    }
  });

  return <LoadingFallback />;
};

const App: Component<RouteSectionProps<unknown>> = (props) => {
  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', flex: '1' }}>
      <Topbar />
      {props.children}
      <Footer />
    </div>
  );
};

const wrapLazyComponent = (addon: { path: string; name: string }) => {
  return (props: any) => {
    const params = useSearchParams();
    const i18n = useI18n();

    // Update store with i18n functions using setStore (the proper way)
    setStore('i18n', {
      t: i18n.t,
      tp: i18n.tp,
      formatDate: i18n.formatDate,
      formatNumber: i18n.formatNumber,
      formatCurrency: i18n.formatCurrency,
      locale: i18n.locale,
      setLocale: i18n.setLocale,
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

    // Create a wrapper component that tracks selectedOrgId reactively
    const ReactiveWrapper: Component = () => {
      // Access selectedOrgId in this component's render to create reactive dependency
      const orgId = () => store.organizations.selectedId;

      // Use key to force remount when org changes
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
          {/* Use a Show with keyed to force re-render when orgId changes */}
          <Show when={orgId()} keyed>
            {(currentOrgId) => (
              <LazyComponent
                {...props}
                store={store}
                selectedOrgId={currentOrgId}
                params={params}
              />
            )}
          </Show>
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
                    const params = useParams();
                    return (
                      <Show when={params.orgId} keyed>
                        {(orgId) => {
                          const Component = wrapLazyComponent(addon);
                          return <Component {...props} key={orgId} />;
                        }}
                      </Show>
                    );
                  };

                  return (
                    <Route path={addon.mount_path} component={KeyedComponent} />
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
    </I18nProvider>
  );
}, root!);
