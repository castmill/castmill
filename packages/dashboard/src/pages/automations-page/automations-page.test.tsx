import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { AutomationsService } from '../../services/automations.service';
import { setStore } from '../../store/store';
import AutomationsPage from './automations-page';
import { automationFixture } from './test-fixtures';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
let allowed: Record<string, boolean>;

vi.mock('../../services/automations.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/automations.service')>();
  return {
    ...actual,
    AutomationsService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      registry: vi.fn(),
      preview: vi.fn(),
      setAssignments: vi.fn(),
      runRule: vi.fn(),
      searchAssignable: vi.fn(),
    },
  };
});
vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylists = vi.fn().mockResolvedValue({ count: 0, data: [] });
    fetchPlaylist = vi
      .fn()
      .mockResolvedValue({ data: { id: 12, name: 'Spring offer' } });
  },
}));
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));
vi.mock('@solidjs/router', () => ({
  useSearchParams: () => [{}, vi.fn()],
  A: (props: { href: string; children: unknown }) => (
    <a href={props.href}>{props.children as string}</a>
  ),
}));
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canPerformAction: (_resource: string, action: string) =>
      allowed[action] ?? false,
  }),
}));
vi.mock('../../store/store', async () => {
  const { createStore } = await import('solid-js/store');
  const [store, setStore] = createStore({
    organizations: { selectedId: 'org-1' },
    permissions: { loaded: true },
  });
  return { store, setStore };
});
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => toastSpies };
});

const automation = automationFixture({
  devices: [{ id: 'd1', name: 'Lobby' }],
  channels: [{ id: 5, name: 'Main' }],
  next_firing: '2030-01-07T09:08:00Z',
});

const renderPage = () =>
  render(() => (
    <I18nProvider>
      <AutomationsPage />
    </I18nProvider>
  ));

// The modal is still animating in, so its buttons are not "accessible" yet.
const modalButton = (name: string) =>
  screen.getByText(name, { selector: 'button span' }).closest('button')!;

const findRow = async () =>
  (await screen.findByText('Spring campaign')).closest('tr') as HTMLElement;

describe('AutomationsPage', () => {
  beforeEach(() => {
    allowed = { list: true, create: true, update: true, delete: true };
    setStore('organizations', 'selectedId', 'org-1');
    setStore('permissions', 'loaded', true);
    vi.mocked(AutomationsService.list).mockResolvedValue({
      data: [automation],
      count: 1,
    });
    vi.mocked(AutomationsService.registry).mockResolvedValue({
      sources: [{ type: 'clock', conditions: [], required_capability: 'x' }],
      actions: [{ type: 'interrupt', supports: [], required_capability: 'y' }],
    } as never);
    vi.mocked(AutomationsService.preview).mockResolvedValue({
      timezone: 'UTC',
      occurrences: [],
    });
    vi.mocked(AutomationsService.searchAssignable).mockResolvedValue({
      count: 0,
      data: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists automations with summaries, assignments and next firing', async () => {
    renderPage();
    const row = await findRow();
    expect(AutomationsService.list).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ page: 1, pageSize: 10 })
    );
    expect(AutomationsService.registry).toHaveBeenCalledWith('org-1');
    expect(row).toHaveTextContent('Every hour at :08');
    expect(row).toHaveTextContent('+1 more');
    expect(
      within(row).getByTitle('1 devices and 1 channels')
    ).toHaveTextContent('2');
    expect(row).toHaveTextContent('2030');
  });

  it('shows placeholders for automations without rules or firings', async () => {
    vi.mocked(AutomationsService.list).mockResolvedValue({
      data: [
        automationFixture({ rules: [] }),
        automationFixture({ id: 2, name: 'Off', enabled: false }),
      ],
      count: 2,
    });
    renderPage();
    const row = await findRow();
    expect(row).toHaveTextContent('No rules yet');
    expect(row).toHaveTextContent('No upcoming firings');
    expect((await screen.findByText('Off')).closest('tr')).toHaveTextContent(
      'Disabled'
    );
  });

  it('shows a toast when loading fails', async () => {
    vi.mocked(AutomationsService.list).mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Could not load automations'
      )
    );
  });

  it('shows a no-access message', () => {
    allowed = {};
    renderPage();
    expect(screen.getByTestId('automations-no-access')).toBeInTheDocument();
  });

  it('toggles an automation', async () => {
    vi.mocked(AutomationsService.update).mockResolvedValue({
      ...automation,
      enabled: false,
    });
    renderPage();
    await findRow();
    const toggle = screen.getByRole('switch', {
      name: 'Enable or disable "Spring campaign"',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(AutomationsService.update).toHaveBeenCalledWith('org-1', 1, {
        enabled: false,
      })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('switch', {
          name: 'Enable or disable "Spring campaign"',
        })
      ).toHaveAttribute('aria-checked', 'false')
    );
  });

  it('reports toggle failures', async () => {
    vi.mocked(AutomationsService.update).mockRejectedValue(new Error('nope'));
    renderPage();
    await findRow();
    fireEvent.click(screen.getByRole('switch', { name: /Enable or disable/ }));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Could not save the automation: nope'
      )
    );
  });

  it('creates an automation and opens the editor', async () => {
    vi.mocked(AutomationsService.create).mockResolvedValue(
      automationFixture({ id: 9, name: 'Lunch', rules: [] })
    );
    renderPage();
    await findRow();
    fireEvent.click(screen.getByRole('button', { name: /New automation/ }));
    const input = await screen.findByPlaceholderText(
      'e.g. Hourly spring offer'
    );
    const createButton = modalButton('Create');
    expect(createButton).toBeDisabled();
    fireEvent.input(input, { target: { value: '  Lunch ' } });
    fireEvent.click(createButton);
    await waitFor(() =>
      expect(AutomationsService.create).toHaveBeenCalledWith('org-1', {
        name: 'Lunch',
        enabled: true,
        rules: [],
      })
    );
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith(
        'Automation "Lunch" created'
      )
    );
    expect(await screen.findByDisplayValue('Lunch')).toBeInTheDocument();
  });

  it('reports create failures and cancels', async () => {
    vi.mocked(AutomationsService.create).mockRejectedValue(new Error('dup'));
    renderPage();
    await findRow();
    fireEvent.click(screen.getByRole('button', { name: /New automation/ }));
    fireEvent.input(
      await screen.findByPlaceholderText('e.g. Hourly spring offer'),
      { target: { value: 'X' } }
    );
    fireEvent.click(modalButton('Create'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Could not save the automation: dup'
      )
    );
    fireEvent.click(modalButton('Cancel'));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('e.g. Hourly spring offer')
      ).not.toBeInTheDocument()
    );
  });

  it('deletes after confirmation', async () => {
    vi.mocked(AutomationsService.remove).mockResolvedValue(undefined);
    renderPage();
    const row = await findRow();
    fireEvent.click(within(row).getByLabelText('Delete Spring campaign'));
    expect(
      await screen.findByText(
        /Are you sure you want to delete "Spring campaign"/
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(AutomationsService.remove).toHaveBeenCalledWith('org-1', 1)
    );
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith(
        'Automation "Spring campaign" deleted'
      )
    );
  });

  it('reports delete failures', async () => {
    vi.mocked(AutomationsService.remove).mockRejectedValue(new Error('locked'));
    renderPage();
    fireEvent.click(
      within(await findRow()).getByLabelText('Delete Spring campaign')
    );
    fireEvent.click(await screen.findByText('Confirm'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Could not delete the automation: locked'
      )
    );
  });

  it('hides delete and disables create without permission', async () => {
    allowed = { list: true };
    renderPage();
    const row = await findRow();
    expect(
      within(row).queryByLabelText('Delete Spring campaign')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /New automation/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: /Enable or disable/ })
    ).toBeDisabled();
  });

  describe('editor', () => {
    const openEditor = async () => {
      renderPage();
      fireEvent.click(
        within(await findRow()).getByLabelText('View Spring campaign')
      );
      return screen.findByDisplayValue('Spring campaign');
    };

    it('renames the automation', async () => {
      vi.mocked(AutomationsService.update).mockResolvedValue({
        ...automation,
        name: 'Renamed',
      });
      const input = await openEditor();
      fireEvent.input(input, { target: { value: 'Spring campaign' } });
      fireEvent.change(input);
      expect(AutomationsService.update).not.toHaveBeenCalled();
      fireEvent.input(input, { target: { value: '   ' } });
      fireEvent.change(input);
      expect(input).toHaveValue('Spring campaign');
      fireEvent.input(input, { target: { value: 'Renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.change(input);
      await waitFor(() =>
        expect(AutomationsService.update).toHaveBeenCalledWith('org-1', 1, {
          name: 'Renamed',
        })
      );
      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith('Automation saved')
      );
    });

    it('toggles enabled from the editor and reports errors', async () => {
      vi.mocked(AutomationsService.update).mockRejectedValue(new Error('x'));
      await openEditor();
      fireEvent.click(screen.getByRole('switch', { name: 'Enabled' }));
      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith(
          'Could not save the automation: x'
        )
      );
    });

    it('reorders rules, runs a rule and saves assignments', async () => {
      vi.mocked(AutomationsService.update).mockImplementation(
        async (_org, _id, attrs) => ({ ...automation, ...attrs }) as never
      );
      vi.mocked(AutomationsService.runRule).mockResolvedValue({ devices: 3 });
      vi.mocked(AutomationsService.setAssignments).mockResolvedValue({
        ...automation,
        channels: [],
      });
      await openEditor();
      expect(screen.getByText('Rules (2)')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Move rule 1 down' }));
      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith('Rules saved')
      );
      expect(
        vi
          .mocked(AutomationsService.update)
          .mock.lastCall![2].rules!.map((rule) => rule.id)
      ).toEqual(['r2', 'r1']);

      fireEvent.click(screen.getByRole('button', { name: 'Run rule 1 now' }));
      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith(
          'Rule sent to 3 displays'
        )
      );
      expect(AutomationsService.runRule).toHaveBeenCalledWith('org-1', 1, 'r2');

      fireEvent.click(screen.getByText('Assignments (2)'));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Remove Main' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save assignments' }));
      await waitFor(() =>
        expect(AutomationsService.setAssignments).toHaveBeenCalledWith(
          'org-1',
          1,
          { devices: ['d1'], channels: [] }
        )
      );
      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith('Assignments saved')
      );
    });

    it('reports run and assignment failures', async () => {
      vi.mocked(AutomationsService.runRule).mockRejectedValue(new Error('off'));
      vi.mocked(AutomationsService.setAssignments).mockRejectedValue(
        new Error('bad')
      );
      await openEditor();
      fireEvent.click(screen.getByRole('button', { name: 'Run rule 1 now' }));
      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith(
          'Could not run the rule: off'
        )
      );
      fireEvent.click(screen.getByText('Assignments (2)'));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Remove Main' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save assignments' }));
      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith(
          'Could not save the automation: bad'
        )
      );
    });

    it('closes the editor', async () => {
      await openEditor();
      fireEvent.click(screen.getByTitle('Close'));
      await waitFor(() =>
        expect(
          screen.queryByDisplayValue('Spring campaign')
        ).not.toBeInTheDocument()
      );
    });
  });
});
