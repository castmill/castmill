import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import {
  createMemoryHistory,
  MemoryRouter,
  Route,
  RouteSectionProps,
  useLocation,
} from '@solidjs/router';
import { Component, createEffect, createSignal, on, onCleanup } from 'solid-js';
import ProtectedRoute from './protected-route';
import { organizationRoute } from './organization-route';
import SidePanel from './sidepanel/sidepanel';
import { AddOnTree } from '../classes/addon-tree';
import { store, setStore } from '../store/store';
import { DESKTOP, mockViewport } from './sidepanel/viewport.test-utils';

const organizations = [
  { id: 'org-1', name: 'Org One', onboarding_completed: true },
  { id: 'org-2', name: 'Org Two', onboarding_completed: true },
].map((org) => ({ ...org, created_at: '', updated_at: '' }));

vi.mock('./auth', () => ({
  checkAuth: () => true,
  getUser: () => ({ id: 'user-1' }),
  loginUser: vi.fn(),
}));
const getAll = vi.hoisted(() => vi.fn());
vi.mock('../services/organizations.service', () => ({
  OrganizationsService: { getAll },
}));
vi.mock('../services/network.service', () => ({
  NetworkService: {
    checkAdminStatus: async () => ({ is_admin: false }),
    getPublicSettings: async () => ({}),
  },
}));
vi.mock('../services/onboarding.service', () => ({
  OnboardingService: {
    getProgress: async () => ({
      completed_steps: [],
      is_completed: true,
      dismissed: true,
    }),
  },
}));
vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ loadPermissions: vi.fn() }),
}));
vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: () => 'en',
    extendTranslations: vi.fn(),
  }),
}));
vi.mock('@castmill/ui-common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@castmill/ui-common')>()),
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));
vi.mock('./onboarding-dialog/onboarding-dialog', () => ({
  OnboardingDialog: () => null,
}));
vi.mock('./onboarding-tour/onboarding-tour', () => ({
  OnboardingTour: () => null,
}));

const loads: { orgId: string | null; path: string }[] = [];

const Page = () => {
  const location = useLocation();
  createEffect(
    on(
      () => store.organizations.selectedId,
      (orgId) => loads.push({ orgId, path: location.pathname })
    )
  );
  return <div data-testid="path">{location.pathname + location.search}</div>;
};

const renderDashboard = (
  path = '/org/org-1/teams',
  OrgPage: Component<RouteSectionProps> = Page
) => {
  const history = createMemoryHistory();
  history.set({ value: path, replace: true, scroll: false });
  render(() => (
    <MemoryRouter history={history}>
      <Route
        path="/"
        component={(props) => (
          <ProtectedRoute>
            {() => (
              <>
                <SidePanel addons={new AddOnTree([])} />
                {props.children}
              </>
            )}
          </ProtectedRoute>
        )}
      >
        <Route path="/org/:orgId/teams" component={OrgPage} />
        <Route path="/settings" component={Page} />
        <Route path="/network" component={Page} />
        <Route path="/org/:orgId" component={Page} />
        <Route path="/" component={Page} />
      </Route>
    </MemoryRouter>
  ));
  return history;
};

const selectOrganization = (id: string) =>
  fireEvent.change(
    screen.getByRole('combobox', { name: 'sidebar.organization' }),
    {
      target: { value: id },
    }
  );

describe('organization switching with the real router and store', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockViewport(DESKTOP);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    localStorage.clear();
    loads.length = 0;
    getAll.mockReset();
    getAll.mockResolvedValue(organizations);
    setStore('organizations', {
      data: organizations,
      loaded: true,
      loading: false,
      selectedId: 'org-1',
      selectedName: 'Org One',
    });
    setStore('loadedAddons', true);
    setStore('loadingAddons', false);
    setStore('addons', []);
    setStore('network', { loaded: true, loading: false, isAdmin: false });
    setStore('networkSettings', { loaded: true, loading: false });
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.restoreAllMocks();
  });

  it('switches once without loading an organization before its URL changes', async () => {
    renderDashboard('/org/org-1/teams?itemId=old-team');
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    loads.length = 0;

    selectOrganization('org-2');

    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/org/org-2/teams')
    );
    expect(store.organizations.selectedId).toBe('org-2');
    expect(store.organizations.selectedName).toBe('Org Two');
    expect(screen.getByRole('combobox')).toHaveValue('org-2');
    expect(screen.getByTestId('path')).not.toHaveTextContent('itemId');
    expect(loads).toEqual([{ orgId: 'org-2', path: '/org/org-2/teams' }]);
  });

  it('keeps the selector and store in sync with browser back and forward', async () => {
    const history = renderDashboard();
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    selectOrganization('org-2');
    await waitFor(() => expect(store.organizations.selectedId).toBe('org-2'));

    history.back();
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveValue('org-1')
    );
    expect(store.organizations.selectedId).toBe('org-1');
    history.forward();
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveValue('org-2')
    );
    expect(store.organizations.selectedId).toBe('org-2');
  });

  it('changes the selection on global settings without leaving the page', async () => {
    renderDashboard('/settings');
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    selectOrganization('org-2');
    expect(store.organizations.selectedId).toBe('org-2');
    expect(screen.getByTestId('path')).toHaveTextContent('/settings');
    expect(screen.getByRole('combobox')).toHaveValue('org-2');
  });

  it('navigates from network administration to the selected organization', async () => {
    renderDashboard('/network');
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    selectOrganization('org-2');
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/org/org-2')
    );
    expect(store.organizations.selectedId).toBe('org-2');
  });

  it('mounts organization pages with the matching store and discards old local state', async () => {
    const mounted: (string | null)[] = [];
    const disposed: (string | null)[] = [];
    const responses = new Map<string | null, (rows: string) => void>();
    const ScopedPage = organizationRoute(() => {
      const orgId = store.organizations.selectedId;
      mounted.push(orgId);
      onCleanup(() => disposed.push(orgId));
      const [rows, setRows] = createSignal('');
      responses.set(orgId, setRows);
      return <div data-testid="rows">{rows()}</div>;
    });
    const history = renderDashboard('/org/org-1/teams', ScopedPage);
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    responses.get('org-1')!('Old team');
    expect(screen.getByTestId('rows')).toHaveTextContent('Old team');

    selectOrganization('org-2');
    await waitFor(() => expect(mounted).toEqual(['org-1', 'org-2']));
    expect(disposed).toEqual(['org-1']);
    expect(screen.getByTestId('rows')).toBeEmptyDOMElement();
    responses.get('org-2')!('New team');
    responses.get('org-1')!('Late old team');
    expect(screen.getByTestId('rows')).toHaveTextContent('New team');

    // Query-only navigation must not discard the current page or drawer.
    history.set({
      value: '/org/org-2/teams?itemId=new-team',
      replace: false,
      scroll: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mounted).toEqual(['org-1', 'org-2']);
    expect(screen.getByTestId('rows')).toHaveTextContent('New team');

    history.back();
    history.back();
    await waitFor(() => expect(mounted).toEqual(['org-1', 'org-2', 'org-1']));
    expect(disposed).toEqual(['org-1', 'org-2']);
  });

  it('does not initialize a deep-linked page with the previously selected organization', async () => {
    const mounted: (string | null)[] = [];
    const ScopedPage = organizationRoute(() => {
      mounted.push(store.organizations.selectedId);
      return <Page />;
    });
    renderDashboard('/org/org-2/teams', ScopedPage);
    await waitFor(() => expect(mounted).toEqual(['org-2']));
    expect(screen.getByRole('combobox')).toHaveValue('org-2');
  });

  it('settles on the last choice when selections change rapidly', async () => {
    renderDashboard();
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    selectOrganization('org-2');
    // User input events run in separate tasks; let the router commit each event.
    await new Promise((resolve) => setTimeout(resolve, 0));
    selectOrganization('org-1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.organizations.selectedId).toBe('org-1');
    expect(screen.getByTestId('path')).toHaveTextContent('/org/org-1/teams');
    expect(screen.getByRole('combobox')).toHaveValue('org-1');
    expect(localStorage.getItem('castmill_last_organization_id')).toBe('org-1');
  });

  it('redirects a deep link to an unknown organization', async () => {
    renderDashboard('/org/org-9/teams');
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/org/org-1/teams')
    );
    expect(store.organizations.selectedId).toBe('org-1');
  });

  it('redirects client-side navigation to an unknown organization', async () => {
    const history = renderDashboard();
    await waitFor(() => expect(store.organizations.loading).toBe(false));
    selectOrganization('org-2');
    // Let the switch settle so it cannot mask the redirect under test.
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/org/org-2/teams')
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    history.set({ value: '/org/org-9/teams', replace: false, scroll: false });
    // Let the navigation commit; otherwise the old path would satisfy waitFor.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/org/org-2/teams')
    );
    expect(store.organizations.selectedId).toBe('org-2');
  });

  it('sends users without organizations to the organization picker', async () => {
    getAll.mockResolvedValue([]);
    renderDashboard('/org/org-1/teams');
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/)
    );
  });

  it('does not redirect a newly joined organization before the list reloads', async () => {
    // Accepting an invitation navigates to an organization that the stale
    // store does not contain yet.
    setStore('organizations', 'data', [organizations[0]]);
    let finishLoading!: (orgs: typeof organizations) => void;
    getAll.mockReturnValue(new Promise((resolve) => (finishLoading = resolve)));
    renderDashboard('/org/org-2/teams');
    await waitFor(() => expect(getAll).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId('path')).toHaveTextContent('/org/org-2/teams');

    finishLoading(organizations);
    await waitFor(() => expect(store.organizations.selectedId).toBe('org-2'));
    expect(screen.getByTestId('path')).toHaveTextContent('/org/org-2/teams');
  });
});
