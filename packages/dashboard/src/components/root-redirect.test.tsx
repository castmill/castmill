import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import {
  createMemoryHistory,
  MemoryRouter,
  Route,
  useLocation,
} from '@solidjs/router';
import { createStore } from 'solid-js/store';
import RootRedirect from './root-redirect';
import { setStore } from '../store/store';

vi.mock('../store/store', () => {
  const [store, setStore] = createStore({
    organizations: {
      data: [] as { id: string }[],
      loaded: false,
      loading: false,
    },
  });
  return { store, setStore };
});

vi.mock('../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const organization = {
  id: 'org-1',
  name: 'Test organization',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const Destination = () => {
  const location = useLocation();
  return (
    <div data-testid="destination">{location.pathname + location.search}</div>
  );
};

const renderRedirect = (url = '/') => {
  const history = createMemoryHistory();
  history.set({ value: url, replace: true, scroll: false });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="/" component={RootRedirect} />
      <Route path="/org/:orgId/*" component={Destination} />
    </MemoryRouter>
  ));
};

describe('RootRedirect', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setStore('organizations', {
      data: [],
      loaded: false,
      loading: false,
    });
  });

  afterAll(async () => {
    // MemoryRouter schedules scrolling after navigation.
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.restoreAllMocks();
  });

  it('waits for organizations then forwards the QR code to the devices page', async () => {
    renderRedirect('/?registrationCode=XUFUG53BKL');
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument();

    setStore('organizations', {
      data: [organization],
      loaded: true,
    });

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent(
        '/org/org-1/devices?registrationCode=XUFUG53BKL'
      )
    );
  });

  it('forwards the code immediately when organizations are already loaded', async () => {
    setStore('organizations', { data: [organization], loaded: true });
    renderRedirect('/?registrationCode=code%26other%3Dvalue');

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent(
        '/org/org-1/devices?registrationCode=code%26other%3Dvalue'
      )
    );
  });

  it('waits while organizations are being refreshed', async () => {
    setStore('organizations', {
      data: [{ ...organization, id: 'old-org' }],
      loaded: true,
      loading: true,
    });
    renderRedirect('/?registrationCode=XUFUG53BKL');
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument();

    setStore('organizations', {
      data: [organization],
      loading: false,
    });
    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent(
        '/org/org-1/devices?registrationCode=XUFUG53BKL'
      )
    );
  });

  it.each(['/', '/?registrationCode='])(
    'preserves the normal organization landing page for %s',
    async (url) => {
      setStore('organizations', { data: [organization], loaded: true });
      renderRedirect(url);

      await waitFor(() =>
        expect(screen.getByTestId('destination')).toHaveTextContent(
          '/org/org-1/'
        )
      );
    }
  );

  it('keeps the existing no-organizations message', () => {
    setStore('organizations', { loaded: true });
    renderRedirect('/?registrationCode=XUFUG53BKL');

    expect(
      screen.getByText('dashboard.noOrganizations.title')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('destination')).not.toBeInTheDocument();
  });
});
