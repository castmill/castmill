/* @refresh reload */
import './index.scss';
import { baseUrl } from './env';

import { render } from 'solid-js/web';
import {
  Router,
  Route,
  RouteSectionProps,
  useSearchParams,
} from '@solidjs/router';

import { Component, For, Suspense, lazy } from 'solid-js';
import { loginUser } from './components/auth';
import ProtectedRoute from './components/protected-route';
import Topbar from './components/topbar/topbar';
import SettingsPage from './pages/settings-page/settings-page';
import Footer from './components/footer/footer';
import SearchPage from './pages/search-page/search-page';

import { AddOnTree } from './classes/addon-tree';

import { store } from './store/store';
import UsagePage from './pages/usage-page/usage-page';
import TeamsPage from './pages/teams-page/teams-page';
import TeamsInvitationPage from './pages/teams-invitations-page/teams-invitations-page';
import OrganizationPage from './pages/organization-page/organization-page';
import OrganizationsInvitationPage from './pages/organization-invitations/organizations-invitations-page';
import ChannelsPage from './pages/channels-page/channels-page';
import { I18nProvider, useI18n } from './i18n';

const Login = lazy(() => import('./components/login/login'));
const SignUp = lazy(() => import('./components/signup/signup'));
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
  const { t } = useI18n();
  return <div>{t('common.loading')}</div>;
};

const App: Component<RouteSectionProps<unknown>> = (props) => {
  return (
    <>
      <Topbar />
      {props.children}
      <Footer />
    </>
  );
};

const wrapLazyComponent = (addon: { path: string }) => {
  return (props: any) => {
    const params = useSearchParams();
    const i18n = useI18n();

    const LazyComponent = lazy(() => import(`${addOnBasePath}${addon.path}`));
    
    // Create a store with i18n functions included
    const storeWithI18n = {
      ...store,
      i18n: {
        t: i18n.t,
        tp: i18n.tp,
        formatDate: i18n.formatDate,
        formatNumber: i18n.formatNumber,
        formatCurrency: i18n.formatCurrency,
        locale: i18n.locale,
        setLocale: i18n.setLocale,
      },
    };
    
    return <LazyComponent {...props} store={storeWithI18n} params={params} />;
  };
};

render(() => {
  const Dashboard = lazy(async () => {
    await loginUser();
    return import('./components/dashboard/dashboard');
  });

  return (
    <I18nProvider>
      <Router root={App}>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={SignUp} />
        <Route
          path="/"
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
          <Route path="" component={EmptyComponent} />
          <Route path="settings" component={SettingsPage} />
          <Route path="search" component={SearchPage} />
          <Route path="usage" component={UsagePage} />
          <Route path="teams" component={TeamsPage} />
          <Route path="organization" component={OrganizationPage} />
          <Route path="channels" component={ChannelsPage} />
          <Route path="invite" component={TeamsInvitationPage} />
          <Route
            path="invite-organization"
            component={OrganizationsInvitationPage}
          />

          {/* Dynamically generate routes for AddOns */}
          <For each={store.addons}>
            {(addon) => {
              if (!addon.mount_path) {
                return null;
              }
              return (
                <Route
                  path={addon.mount_path}
                  component={wrapLazyComponent(addon)}
                />
              );
            }}
          </For>

          <Route path="*404" component={NotFound} />
        </Route>
      </Router>
    </I18nProvider>
  );
}, root!);
