/* @refresh reload */
import "./index.scss";

import { render } from "solid-js/web";
import { Router, Route, RouteSectionProps } from "@solidjs/router";

import { Component, Suspense, lazy, onMount } from "solid-js";
import { loginUser } from "./components/auth";
import ProtectedRoute from "./components/protected-route";
import Topbar from "./components/topbar/topbar";
import SettingsPage from "./pages/settings-page/settings-page";
import Footer from "./components/footer/footer";
import SearchPage from "./pages/search-page/search-page";

const Login = lazy(() => import("./components/login/login"));
const SignUp = lazy(() => import("./components/signup/signup"));
const NotFound = lazy(() => import("./components/not-found"));

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?"
  );
}

const Dashboard = lazy(async () => {
  console.log("Logging in...");
  await loginUser();
  console.log("Logged in...");
  return import("./components/dashboard/dashboard");
});

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

render(
  () => (
    <Router root={App}>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route
        path="/"
        component={(props: any) => (
          <Suspense fallback={<div>Loading...</div>}>
            <ProtectedRoute>
              <Dashboard {...props} />
            </ProtectedRoute>
          </Suspense>
        )}
      >
        <Route path="" component={EmptyComponent} />
        <Route path="settings" component={SettingsPage} />
        <Route path="search" component={SearchPage} />
      </Route>

      <Route path="*404" component={NotFound} />
    </Router>
  ),
  root!
);
