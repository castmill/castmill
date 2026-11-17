import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@solidjs/testing-library';
import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router';
import { createStore } from 'solid-js/store';
import SidePanel from './sidepanel';
import { AddOnTree } from '../../classes/addon-tree';
import { setStore } from '../../store/store';
import type { Action, ResourceType } from '../../services/permissions.service';

const organization = {
  id: 'org-1',
  name: 'Acme',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

vi.mock('../../store/store', () => {
  const [store, setStore] = createStore({
    organizations: {
      data: [] as { id: string; name: string }[],
      selectedId: undefined as string | undefined,
      selectedName: undefined as string | undefined,
    },
    network: { isAdmin: false },
    permissions: undefined as
      | { role: string; matrix: Record<string, string[]> }
      | undefined,
  });
  return { store, setStore };
});

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/permissions.service', () => ({
  canPerformAction: (
    matrix: Record<string, string[]> | undefined,
    resource: string,
    action: string
  ) => !!matrix?.[resource]?.includes(action),
}));

// Add-on icons are fetched from the server; render none in tests.
vi.mock('solid-js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('solid-js')>()),
  lazy: () => () => null,
}));

const addon = (name: string, mount_point: string, mount_path: string) => ({
  id: name,
  name,
  description: '',
  version: '1.0.0',
  author: '',
  license: '',
  path: '',
  mount_point,
  mount_path,
  icon: `/${name}.svg`,
  component: '',
});

const addons = [
  addon('Devices', 'sidepanel.devices', '/devices/*'),
  addon('Help', 'sidepanel.bottom.help', '/help'),
  addon('Billing', 'network.billing', '/billing'),
];

const organizationLinks = [
  'sidebar.organization',
  'Devices',
  'sidebar.channels',
  'sidebar.automations',
  'sidebar.teams',
  'sidebar.tags',
  'sidebar.feeds',
  'sidebar.agents',
  'sidebar.usage',
  'Help',
];

const networkLinks = [
  'sidebar.network',
  'sidebar.networkSettings',
  'sidebar.networkOrganizations',
  'sidebar.networkUsers',
  'sidebar.networkWidgets',
  'Billing',
];

const renderSidePanel = () => {
  const history = createMemoryHistory();
  history.set({ value: '/', replace: true, scroll: false });
  return render(() => (
    <MemoryRouter history={history}>
      <Route
        path="*"
        component={() => <SidePanel addons={new AddOnTree(addons)} />}
      />
    </MemoryRouter>
  ));
};

const item = (text: string) =>
  within(
    document.querySelector<HTMLElement>('.castmill-sidepanel .links')!
  ).getByText(text).parentElement!;

describe('SidePanel', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setStore('network', { isAdmin: true });
    setStore('permissions', {
      role: 'admin',
      matrix: { automations: ['list'] } as Record<ResourceType, Action[]>,
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.restoreAllMocks();
  });

  it('disables organization pages but keeps settings and network pages without an organization', () => {
    setStore('organizations', {
      data: [],
      selectedId: undefined,
      selectedName: undefined,
    });
    renderSidePanel();

    for (const text of organizationLinks) {
      const link = item(text);
      expect(link.tagName).toBe('SPAN');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('title', 'sidebar.requiresOrganization');
      expect(link).not.toHaveAttribute('href');
    }

    expect(item('common.settings')).toHaveAttribute('href', '/settings');
    expect(item('sidebar.networkOrganizations')).toHaveAttribute(
      'href',
      '/network/organizations'
    );
    expect(item('Billing')).toHaveAttribute('href', '/network/billing');
    for (const text of networkLinks) {
      expect(item(text).tagName).toBe('A');
    }

    expect(
      document.querySelector('#organization-selector')
    ).not.toBeInTheDocument();
  });

  it('links organization pages to the selected organization', () => {
    setStore('organizations', {
      data: [organization],
      selectedId: 'org-1',
      selectedName: 'Acme',
    });
    renderSidePanel();

    for (const text of organizationLinks) {
      const link = item(text);
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toMatch(/^\/org\/org-1\//);
      expect(link).not.toHaveAttribute('aria-disabled');
    }
    expect(item('Devices')).toHaveAttribute('href', '/org/org-1/devices');

    expect(
      document.querySelector('#organization-selector')
    ).toBeInTheDocument();
  });

  it('hides the network section from users who are not network admins', () => {
    setStore('network', { isAdmin: false });
    renderSidePanel();

    expect(screen.queryByText('sidebar.network')).not.toBeInTheDocument();
  });
});
