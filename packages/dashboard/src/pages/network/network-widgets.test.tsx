import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { HttpError } from '@castmill/ui-common';
import { I18nProvider } from '../../i18n';
import {
  NetworkService,
  NetworkWidgetAccess,
  NetworkWidgetAccessList,
  NetworkWidgetOrganization,
  NetworkWidgetOrganizationList,
} from '../../services/network.service';
import NetworkWidgets from './network-widgets';

const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => toastSpies,
  };
});

vi.mock('../../services/network.service', () => ({
  NetworkService: {
    listWidgetAccess: vi.fn(),
    listWidgetOrganizations: vi.fn(),
    setWidgetAccess: vi.fn(),
    updateWidgetOrganizations: vi.fn(),
  },
}));

const widget = (
  overrides: Partial<NetworkWidgetAccess>
): NetworkWidgetAccess => ({
  id: 1,
  name: 'Weather',
  description: 'Local forecast',
  slug: 'weather',
  icon: '/widgets/weather/icon.svg',
  small_icon: null,
  kind: 'system',
  access: 'all',
  listed_count: 0,
  enabled_count: 3,
  eligible_count: 3,
  organizations_count: 3,
  in_use_count: 1,
  core: false,
  platform_restricted: false,
  ...overrides,
});

const weather = widget({});
const realty = widget({
  id: 2,
  name: 'Realty',
  description: null,
  slug: 'realty',
  icon: '🏠',
  kind: 'network',
  access: 'selected',
  listed_count: 1,
  enabled_count: 1,
  in_use_count: 0,
});
const spotify = widget({
  id: 4,
  name: 'Spotify',
  slug: 'spotify',
  icon: null,
  access: 'except',
  listed_count: 1,
  enabled_count: 2,
});
const image = widget({
  id: 3,
  name: 'Image',
  slug: 'image',
  icon: null,
  core: true,
});

const widgetPage = (
  data: NetworkWidgetAccess[],
  overrides: Partial<NetworkWidgetAccessList> = {}
): NetworkWidgetAccessList => ({
  data,
  summary: { all: 2, except: 1, selected: 1, hidden: 0, total: 4 },
  organizations_count: 3,
  pagination: {
    page: 1,
    page_size: 50,
    total_count: data.length,
    total_pages: 1,
  },
  ...overrides,
});

const alpha = { id: 'org-a', name: 'Alpha', enabled: true, in_use: true };
const beta = { id: 'org-b', name: 'Beta', enabled: true, in_use: false };
const gamma = { id: 'org-c', name: 'Gamma', enabled: true, in_use: false };

const organizationPage = (
  data: NetworkWidgetOrganization[],
  total = data.length
): NetworkWidgetOrganizationList => ({
  data,
  counts: { total: 3, enabled: 3 },
  pagination: {
    page: 1,
    page_size: 20,
    total_count: total,
    total_pages: Math.ceil(total / 20),
  },
});

const renderPage = () =>
  render(() => (
    <I18nProvider>
      <NetworkWidgets />
    </I18nProvider>
  ));

const accessSwitch = (name: string) =>
  screen.findByRole('switch', { name: `Access for ${name}` });

const selectWidget = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole('option', { name }));
  return screen.findByRole('heading', { level: 2, name: name });
};

describe('NetworkWidgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NetworkService.listWidgetAccess).mockResolvedValue(
      widgetPage([weather, realty, spotify, image])
    );
    vi.mocked(NetworkService.listWidgetOrganizations).mockResolvedValue(
      organizationPage([alpha, beta, gamma])
    );
  });

  it('lists widgets with icons and access summaries, selecting the first one', async () => {
    renderPage();

    const list = await screen.findByRole('listbox');
    expect(await within(list).findByText('Weather')).toBeInTheDocument();
    expect(within(list).getByText('1 of 3 organizations')).toBeInTheDocument();
    expect(within(list).getByText('All except 1')).toBeInTheDocument();
    expect(within(list).getByText('🏠')).toBeInTheDocument();
    expect(list.querySelector('img')?.getAttribute('src')).toMatch(
      /\/widgets\/weather\/icon\.svg$/
    );

    expect(screen.getByRole('option', { name: /Weather/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Weather' })
    ).toBeInTheDocument();
    expect(screen.getByText('Organizations using it: 1')).toBeInTheDocument();
    await waitFor(() =>
      expect(NetworkService.listWidgetOrganizations).toHaveBeenCalledWith(1, {
        page: 1,
        pageSize: 20,
        search: undefined,
        status: undefined,
      })
    );
  });

  it('lists organizations in a table, locking those whose playlists use the widget', async () => {
    renderPage();

    expect(await accessSwitch('Alpha')).toBeDisabled();
    expect(await accessSwitch('Beta')).toBeEnabled();
    expect(await accessSwitch('Beta')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByText('In use').length).toBeGreaterThan(0);
  });

  it('turning an organization off excludes it and updates the summaries', async () => {
    vi.mocked(NetworkService.updateWidgetOrganizations).mockResolvedValue({
      ...weather,
      access: 'except',
      listed_count: 1,
      enabled_count: 2,
    });
    renderPage();

    fireEvent.click(await accessSwitch('Beta'));

    await waitFor(() =>
      expect(NetworkService.updateWidgetOrganizations).toHaveBeenCalledWith(1, {
        disable: ['org-b'],
      })
    );
    const list = screen.getByRole('listbox');
    await waitFor(() =>
      expect(within(list).getAllByText('All except 1')).toHaveLength(2)
    );
    expect(screen.getByRole('radio', { name: /^All except/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(
      screen.getByRole('button', { name: /^Excluding\s*2$/ })
    ).toBeInTheDocument();
  });

  it('reverts a toggle and names the organizations that block it', async () => {
    vi.mocked(NetworkService.updateWidgetOrganizations).mockRejectedValue(
      new HttpError('in use', 409, {
        organizations: [{ id: 'org-b', name: 'Beta' }],
      })
    );
    renderPage();

    fireEvent.click(await accessSwitch('Beta'));

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        expect.stringContaining('Beta')
      )
    );
    expect(await accessSwitch('Beta')).toHaveAttribute('aria-checked', 'true');
  });

  it('searches and filters widgets on the server', async () => {
    renderPage();
    await screen.findByRole('listbox');

    fireEvent.input(screen.getByPlaceholderText('Search widgets'), {
      target: { value: 'real' },
    });
    await waitFor(() =>
      expect(NetworkService.listWidgetAccess).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, search: 'real' })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: /^Excluding/ }));
    await waitFor(() =>
      expect(NetworkService.listWidgetAccess).toHaveBeenLastCalledWith(
        expect.objectContaining({ access: 'except', search: 'real' })
      )
    );

    fireEvent.change(screen.getByLabelText('Filter by type'), {
      target: { value: 'network' },
    });
    await waitFor(() =>
      expect(NetworkService.listWidgetAccess).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'network' })
      )
    );
  });

  it('offers to clear filters when nothing matches', async () => {
    renderPage();
    await screen.findByRole('listbox');
    vi.mocked(NetworkService.listWidgetAccess).mockResolvedValue(
      widgetPage([])
    );

    fireEvent.click(screen.getByRole('button', { name: /^Hidden/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Clear filters' })
    );

    await waitFor(() =>
      expect(NetworkService.listWidgetAccess).toHaveBeenLastCalledWith(
        expect.objectContaining({ access: undefined })
      )
    );
  });

  it('confirms before hiding a widget from the network', async () => {
    vi.mocked(NetworkService.setWidgetAccess).mockResolvedValue({
      ...weather,
      access: 'hidden',
      enabled_count: 0,
    });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /^Hidden/ }));
    expect(await screen.findByText('Hide Weather?')).toBeInTheDocument();
    expect(NetworkService.setWidgetAccess).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Hide widget' }));

    await waitFor(() =>
      expect(NetworkService.setWidgetAccess).toHaveBeenCalledWith(1, 'hidden')
    );
    expect(
      await within(screen.getByRole('listbox')).findByText('Hidden')
    ).toBeInTheDocument();
  });

  it('explains when hiding is blocked by organizations using the widget', async () => {
    vi.mocked(NetworkService.setWidgetAccess).mockRejectedValue(
      new HttpError('in use', 409, {
        organizations: ['A', 'B', 'C', 'D'].map((name) => ({ id: name, name })),
      })
    );
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /^Hidden/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hide widget' }));

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        expect.stringContaining('A, B, C and 1 more')
      )
    );
  });

  it('switches to "all except" without confirmation', async () => {
    vi.mocked(NetworkService.setWidgetAccess).mockResolvedValue({
      ...weather,
      access: 'except',
    });
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /^All except/ }));

    await waitFor(() =>
      expect(NetworkService.setWidgetAccess).toHaveBeenCalledWith(1, 'except')
    );
    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: /^All except/ })
      ).toHaveAttribute('aria-checked', 'true')
    );
    expect(
      screen.getByText(
        'Organizations created later get this widget automatically.'
      )
    ).toBeInTheDocument();
  });

  it('protects core widgets', async () => {
    renderPage();
    await selectWidget(/Image/);

    expect(
      await screen.findByText(/Core widget: always available/)
    ).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
    expect(
      screen.queryByPlaceholderText('Search organizations')
    ).not.toBeInTheDocument();
  });

  it('disables every matching organization after confirmation', async () => {
    vi.mocked(NetworkService.updateWidgetOrganizations).mockResolvedValue({
      ...weather,
      access: 'except',
      enabled_count: 1,
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Disable all (3)' })
    );
    expect(
      await screen.findByText('Disable 3 organizations?')
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Disable' }));

    await waitFor(() =>
      expect(NetworkService.updateWidgetOrganizations).toHaveBeenCalledWith(1, {
        all_matching: true,
        enabled: false,
        search: undefined,
      })
    );
  });

  it('changes access of the selected rows from the selection bar', async () => {
    vi.mocked(NetworkService.updateWidgetOrganizations).mockResolvedValue({
      ...weather,
      access: 'except',
    });
    renderPage();
    await accessSwitch('Beta');

    fireEvent.input(screen.getByLabelText('Select row org-b'), {
      target: { checked: true },
    });
    fireEvent.input(screen.getByLabelText('Select row org-c'), {
      target: { checked: true },
    });
    expect(await screen.findByText('2 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Disable access' }));

    await waitFor(() =>
      expect(NetworkService.updateWidgetOrganizations).toHaveBeenCalledWith(1, {
        disable: ['org-b', 'org-c'],
      })
    );
  });

  it('searches, filters and paginates organizations', async () => {
    vi.mocked(NetworkService.listWidgetOrganizations).mockResolvedValue(
      organizationPage([alpha, beta, gamma], 45)
    );
    renderPage();
    await accessSwitch('Beta');

    expect(screen.getByText('1–20 of 45')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(NetworkService.listWidgetOrganizations).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ page: 2 })
      )
    );

    fireEvent.input(screen.getByPlaceholderText('Search organizations'), {
      target: { value: 'gam' },
    });
    await waitFor(() =>
      expect(NetworkService.listWidgetOrganizations).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ page: 1, search: 'gam' })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: /^Can't use/ }));
    await waitFor(() =>
      expect(NetworkService.listWidgetOrganizations).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({ status: 'disabled' })
      )
    );
  });

  it('loads more widgets on demand', async () => {
    vi.mocked(NetworkService.listWidgetAccess)
      .mockResolvedValueOnce(
        widgetPage([weather], {
          pagination: {
            page: 1,
            page_size: 50,
            total_count: 2,
            total_pages: 2,
          },
        })
      )
      .mockResolvedValueOnce(
        widgetPage([realty], {
          pagination: {
            page: 2,
            page_size: 50,
            total_count: 2,
            total_pages: 2,
          },
        })
      );
    renderPage();

    expect(await screen.findByText('Showing 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(
      await screen.findByRole('option', { name: /Realty/ })
    ).toBeInTheDocument();
    expect(NetworkService.listWidgetAccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
    expect(screen.getByText('Showing 2 of 2')).toBeInTheDocument();
  });

  it('moves the selection with the arrow keys', async () => {
    renderPage();
    const list = await screen.findByRole('listbox');
    await within(list).findByText('Weather');

    fireEvent.keyDown(list, { key: 'ArrowDown' });

    expect(screen.getByRole('option', { name: /Realty/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('reports load failures', async () => {
    vi.mocked(NetworkService.listWidgetAccess).mockRejectedValue(
      new Error('offline')
    );
    renderPage();

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith('Failed to load widgets.')
    );
  });
});
