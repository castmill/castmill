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
    const LazyComponent = lazy(() => import(`${addOnBasePath}${addon.path}`));
    return (
      <LazyComponent {...props} store={store} params={useSearchParams()} />
    );
  };
};

render(() => {
  const Dashboard = lazy(async () => {
    await loginUser();
    return import('./components/dashboard/dashboard');
  });

  return (
    <Router root={App}>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route
        path="/"
        component={(props: any) => (
          <Suspense fallback={<div>Loading...</div>}>
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
  );
}, root!);
