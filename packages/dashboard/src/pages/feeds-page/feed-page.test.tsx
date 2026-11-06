import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import FeedPage, { entryFields, parseJsonObject } from './feed-page';
import { curlExample } from './feed-connect';
import { FeedsError, FeedsService } from '../../services/feeds.service';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
const navigate = vi.fn();
const clipboard = vi.fn();
let allowed = ['list', 'show', 'create', 'update', 'delete'];

vi.mock('../../services/feeds.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/feeds.service')>();
  return {
    ...actual,
    FeedsService: {
      get: vi.fn(),
      data: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      sendTest: vi.fn(),
      deleteEntry: vi.fn(),
      clear: vi.fn(),
      tokens: vi.fn(),
      createToken: vi.fn(),
      revokeToken: vi.fn(),
    },
  };
});

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ feedId: 'feed-1' }),
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canPerformAction: (_resource: string, action: string) =>
      allowed.includes(action),
  }),
}));

vi.mock('../../store/store', async () => {
  const { createStore } = await import('solid-js/store');
  const [store, setStore] = createStore({
    organizations: { selectedId: 'org-1' },
  });
  return { store, setStore };
});

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => toastSpies };
});

const feed = {
  id: 'feed-1',
  organization_id: 'org-1',
  name: 'Facebook posts',
  description: 'Latest posts',
  mode: 'list' as const,
  keep: 10,
  schema: { title: 'string' },
  media_fields: [{ path: 'image', mode: 'copy' as const }],
  version: 3,
  data_updated_at: '2026-01-01T10:00:00Z',
  inserted_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  entry_count: 1,
  used_by: [{ id: 7, name: 'Lobby', items: 2 }],
  endpoints: {
    append: 'https://api.example.com/api/v1/feeds/feed-1/entries',
    replace: 'https://api.example.com/api/v1/feeds/feed-1/data',
    read: 'https://api.example.com/api/v1/feeds/feed-1',
  },
};

const entry = {
  id: 'entry-1',
  received_at: '2026-01-01T10:00:00Z',
  external_id: 'post-1',
  title: 'Hello',
};

const token = {
  id: 'token-1',
  feed_id: 'feed-1',
  name: 'Make',
  hint: 'abcd',
  last_used_at: null,
  revoked_at: null,
  inserted_at: '2026-01-01T00:00:00',
};

const renderPage = () =>
  render(() => (
    <I18nProvider>
      <FeedPage />
    </I18nProvider>
  ));

const openTab = async (name: string) => {
  await waitFor(() => expect(screen.getByText('Facebook posts')).toBeTruthy());
  fireEvent.click(screen.getByText(name));
};

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowed = ['list', 'show', 'create', 'update', 'delete'];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboard },
      configurable: true,
    });
    clipboard.mockResolvedValue(undefined);
    vi.mocked(FeedsService.get).mockResolvedValue(feed);
    vi.mocked(FeedsService.data).mockResolvedValue({
      data: { entries: [entry], updated_at: '2026-01-01T10:00:00Z' },
      version: 3,
    });
    vi.mocked(FeedsService.tokens).mockResolvedValue([token]);
  });

  it('shows the latest entries', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText(/"Hello"/)).toBeTruthy());
    expect(screen.getByText('List · Latest posts')).toBeTruthy();
    expect(screen.getByText('External ID: post-1')).toBeTruthy();
    expect(screen.getByTestId('feed-entries').textContent).not.toContain(
      'entry-1'
    );

    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(FeedsService.data).toHaveBeenCalledTimes(2));
  });

  it('sends test entries', async () => {
    vi.mocked(FeedsService.sendTest)
      .mockResolvedValueOnce({
        data: { entries: [{ ...entry, title: 'Test' }], updated_at: null },
        version: 4,
      })
      .mockRejectedValueOnce(new FeedsError('The entry is too large', 422));
    renderPage();
    await waitFor(() => expect(screen.getByText(/"Hello"/)).toBeTruthy());

    const input = screen.getByLabelText('Send a test entry');
    fireEvent.input(input, { target: { value: '[1]' } });
    fireEvent.click(screen.getByText('Send'));
    expect(toastSpies.error).toHaveBeenCalledWith('Enter a valid JSON object.');

    fireEvent.input(input, { target: { value: '{"title": "Test"}' } });
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() => expect(screen.getByText(/"Test"/)).toBeTruthy());
    expect(FeedsService.sendTest).toHaveBeenCalledWith(
      'org-1',
      'feed-1',
      'list',
      { title: 'Test' }
    );
    expect(toastSpies.success).toHaveBeenCalledWith('Test data stored');

    fireEvent.input(input, { target: { value: '{"title": "Big"}' } });
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'The action failed: The entry is too large'
      )
    );
  });

  it('deletes entries and clears the feed after confirmation', async () => {
    vi.mocked(FeedsService.deleteEntry).mockResolvedValue(undefined);
    vi.mocked(FeedsService.clear).mockRejectedValueOnce(new Error('nope'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/"Hello"/)).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Delete entry'));
    fireEvent.click(await screen.findByText('Delete'));
    await waitFor(() =>
      expect(FeedsService.deleteEntry).toHaveBeenCalledWith(
        'org-1',
        'feed-1',
        'entry-1'
      )
    );

    fireEvent.click(screen.getByText('Clear all'));
    expect(await screen.findByText('Clear feed?')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Clear all').at(-1)!);
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith('The action failed: nope')
    );
  });

  it('shows document feeds', async () => {
    vi.mocked(FeedsService.get).mockResolvedValue({
      ...feed,
      mode: 'document',
      description: null,
    });
    vi.mocked(FeedsService.data)
      .mockResolvedValueOnce({
        data: { document: { open: '9-17' }, updated_at: null },
        version: 2,
      })
      .mockResolvedValueOnce({
        data: { document: null, updated_at: null },
        version: 3,
      });
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('feed-document').textContent).toContain('9-17')
    );
    expect(screen.getByText('Last update: Never')).toBeTruthy();
    expect(screen.getByLabelText('Send a test document')).toBeTruthy();

    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() =>
      expect(screen.getByText('No document yet.')).toBeTruthy()
    );
  });

  it('saves settings, lists playlists and deletes the feed', async () => {
    vi.mocked(FeedsService.update)
      .mockResolvedValueOnce({ ...feed, name: 'Posts' })
      .mockRejectedValueOnce(new FeedsError('keep is invalid', 422));
    vi.mocked(FeedsService.remove).mockResolvedValue(undefined);
    renderPage();
    await openTab('Settings');

    expect(screen.getByText('Lobby').getAttribute('href')).toBe(
      '/org/org-1/content/playlists?itemId=7'
    );
    expect(
      (screen.getByLabelText('Entry schema (optional)') as HTMLTextAreaElement)
        .value
    ).toContain('"title"');

    fireEvent.input(screen.getByLabelText('Name'), {
      target: { value: 'Posts' },
    });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(FeedsService.update).toHaveBeenCalledWith(
        'org-1',
        'feed-1',
        expect.objectContaining({ name: 'Posts' })
      )
    );
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith('Feed saved')
    );

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        "Couldn't save the feed: keep is invalid"
      )
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(await screen.findByText('Delete feed?')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Delete').at(-1)!);
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/org/org-1/feeds')
    );
    expect(toastSpies.success).toHaveBeenCalledWith('Feed deleted');
  });

  it('is read-only without permissions', async () => {
    allowed = ['list', 'show'];
    renderPage();
    await waitFor(() => expect(screen.getByText(/"Hello"/)).toBeTruthy());

    expect(screen.queryByText('Clear all')).toBeNull();
    expect(screen.queryByLabelText('Delete entry')).toBeNull();
    expect(screen.queryByLabelText('Send a test entry')).toBeNull();

    fireEvent.click(screen.getByText('Connect'));
    expect(screen.queryByText('New token')).toBeNull();
    expect(FeedsService.tokens).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Settings'));
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('reports missing feeds and loading errors', async () => {
    vi.mocked(FeedsService.get).mockRejectedValueOnce(
      new FeedsError('Not found', 404)
    );
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("This feed doesn't exist or was deleted.")
      ).toBeTruthy()
    );
    unmount();

    vi.mocked(FeedsService.get).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith("Couldn't load the feed.")
    );

    vi.mocked(FeedsService.data).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() => expect(toastSpies.error).toHaveBeenCalledTimes(2));
  });

  describe('Connect tab', () => {
    it('shows endpoints and copies them', async () => {
      renderPage();
      await openTab('Connect');

      expect(screen.getByText(`POST ${feed.endpoints.append}`)).toBeTruthy();
      expect(screen.getByText(`PUT ${feed.endpoints.replace}`)).toBeTruthy();
      expect(screen.getByText(/HTTP › Make a request/)).toBeTruthy();

      fireEvent.click(screen.getByLabelText('Copy: Add entries'));
      await waitFor(() =>
        expect(clipboard).toHaveBeenCalledWith(feed.endpoints.append)
      );
      await waitFor(() =>
        expect(toastSpies.success).toHaveBeenCalledWith(
          'Copied to the clipboard'
        )
      );

      clipboard.mockRejectedValueOnce(new Error('denied'));
      fireEvent.click(screen.getByLabelText('Copy: Read data'));
      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith(
          "Couldn't copy to the clipboard"
        )
      );
    });

    it('hides the append endpoint of document feeds', async () => {
      vi.mocked(FeedsService.get).mockResolvedValue({
        ...feed,
        mode: 'document',
      });
      renderPage();
      await openTab('Connect');

      expect(screen.queryByText(`POST ${feed.endpoints.append}`)).toBeNull();
      expect(screen.queryByText(/HTTP › Make a request/)).toBeNull();
    });

    it('creates tokens and shows the secret once', async () => {
      vi.mocked(FeedsService.createToken).mockResolvedValue({
        token: { ...token, id: 'token-2', name: 'Script' },
        secret: 'cmfeed_secret',
      });
      renderPage();
      await openTab('Connect');
      await waitFor(() => expect(screen.getByText('…abcd')).toBeTruthy());
      expect(screen.getByText('Last used: Never')).toBeTruthy();

      fireEvent.click(screen.getByText('New token'));
      fireEvent.input(await screen.findByPlaceholderText(/Make scenario/), {
        target: { value: ' Script ' },
      });
      fireEvent.click(screen.getByText('Create'));

      await waitFor(() =>
        expect(screen.getByTestId('feed-token-secret').textContent).toBe(
          'cmfeed_secret'
        )
      );
      expect(FeedsService.createToken).toHaveBeenCalledWith(
        'org-1',
        'feed-1',
        'Script'
      );
      expect(screen.getByText(/Bearer cmfeed_secret/)).toBeTruthy();

      fireEvent.click(screen.getAllByText('Copy').at(-1)!);
      await waitFor(() =>
        expect(clipboard).toHaveBeenCalledWith('cmfeed_secret')
      );

      fireEvent.click(screen.getByText('Done'));
      await waitFor(() =>
        expect(screen.queryByTestId('feed-token-secret')).toBeNull()
      );
    });

    it('revokes tokens after confirmation', async () => {
      vi.mocked(FeedsService.tokens)
        .mockResolvedValueOnce([token])
        .mockResolvedValueOnce([
          {
            ...token,
            revoked_at: '2026-01-02T00:00:00',
            last_used_at: '2026-01-01T12:00:00Z',
          },
        ]);
      vi.mocked(FeedsService.revokeToken).mockResolvedValue(token);
      renderPage();
      await openTab('Connect');

      fireEvent.click(await screen.findByText('Revoke'));
      expect(await screen.findByText('Revoke token?')).toBeTruthy();
      fireEvent.click(screen.getAllByText('Revoke').at(-1)!);

      await waitFor(() =>
        expect(FeedsService.revokeToken).toHaveBeenCalledWith(
          'org-1',
          'feed-1',
          'token-1'
        )
      );
      await waitFor(() => expect(screen.getByText('Revoked')).toBeTruthy());
    });

    it('reports token errors', async () => {
      vi.mocked(FeedsService.tokens).mockRejectedValueOnce(new Error('boom'));
      vi.mocked(FeedsService.createToken).mockRejectedValue(
        new FeedsError('nope', 500)
      );
      renderPage();
      await openTab('Connect');
      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith("Couldn't load the feed.")
      );
      expect(screen.getByText('No tokens yet.')).toBeTruthy();

      fireEvent.click(screen.getByText('New token'));
      fireEvent.click(await screen.findByText('Create'));
      await waitFor(() =>
        expect(toastSpies.error).toHaveBeenCalledWith('The action failed: nope')
      );
    });
  });
});

describe('feed page helpers', () => {
  it('hides the fields Castmill adds to entries', () => {
    expect(entryFields(entry)).toEqual({ title: 'Hello' });
  });

  it('parses JSON objects only', () => {
    expect(parseJsonObject('{"a": 1}')).toEqual({ a: 1 });
    expect(parseJsonObject('[1]')).toBeNull();
    expect(parseJsonObject('1')).toBeNull();
    expect(parseJsonObject('{')).toBeNull();
  });

  it('builds curl examples', () => {
    expect(curlExample('https://x/entries')).toContain('Bearer <TOKEN>');
    expect(curlExample('https://x/entries', 'cmfeed_1')).toContain(
      'Bearer cmfeed_1'
    );
  });
});
