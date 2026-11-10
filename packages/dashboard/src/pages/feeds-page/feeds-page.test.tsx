import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { I18nProvider } from '../../i18n';
import FeedsPage from './feeds-page';
import { FeedForm, emptyFeedForm, feedFormToAttrs } from './feed-form';
import { FeedConnect } from './feed-connect';
import { FeedsError, FeedsService } from '../../services/feeds.service';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
const navigate = vi.fn();
let allowed = ['list', 'show', 'create', 'update', 'delete'];

vi.mock('../../services/feeds.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/feeds.service')>();
  return {
    ...actual,
    FeedsService: { list: vi.fn(), create: vi.fn(), tokens: vi.fn() },
  };
});

vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));

vi.mock('@solidjs/router', () => ({
  useNavigate: () => navigate,
  A: (props: any) => (
    <a
      href={props.href}
      onClick={(event) => {
        props.onClick?.(event);
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {props.children}
    </a>
  ),
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
  media_fields: [],
  version: 3,
  data_updated_at: '2026-01-01T10:00:00',
  inserted_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  entry_count: 4,
  usage_count: 2,
};

const renderPage = () =>
  render(() => (
    <I18nProvider>
      <FeedsPage />
    </I18nProvider>
  ));

describe('FeedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allowed = ['list', 'show', 'create', 'update', 'delete'];
    vi.mocked(FeedsService.list).mockResolvedValue({ data: [feed], count: 1 });
  });

  it('lists feeds and opens one', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Facebook posts')).toBeTruthy()
    );
    expect(FeedsService.list).toHaveBeenCalledWith('org-1', {
      page: 1,
      pageSize: 100,
    });
    expect(screen.getByText('Latest posts')).toBeTruthy();
    expect(screen.getByText('List')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Facebook posts' }));
    expect(navigate).toHaveBeenCalledWith('/org/org-1/feeds/feed-1');
  });

  it('loads all pages when the organization has more than 100 feeds', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...feed,
      id: `feed-${index}`,
      name: `Feed ${index}`,
    }));
    const secondPage = { ...feed, id: 'feed-100', name: 'Feed 100' };
    vi.mocked(FeedsService.list)
      .mockResolvedValueOnce({ data: firstPage, count: 101 })
      .mockResolvedValueOnce({ data: [secondPage], count: 101 });
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Feed 100' })).toBeTruthy()
    );
    expect(FeedsService.list).toHaveBeenNthCalledWith(1, 'org-1', {
      page: 1,
      pageSize: 100,
    });
    expect(FeedsService.list).toHaveBeenNthCalledWith(2, 'org-1', {
      page: 2,
      pageSize: 100,
    });
  });

  it('shows document feeds and feeds never written', async () => {
    vi.mocked(FeedsService.list).mockResolvedValue({
      data: [
        {
          ...feed,
          mode: 'document',
          entry_count: null,
          data_updated_at: null,
          usage_count: undefined,
          description: null,
        },
      ],
      count: 1,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('Document')).toBeTruthy());
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy();
  });

  it('creates a feed and opens it', async () => {
    vi.mocked(FeedsService.create).mockResolvedValue({
      ...feed,
      id: 'feed-2',
      used_by: [],
      endpoints: { append: '', replace: '', read: '' },
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Facebook posts')).toBeTruthy()
    );

    fireEvent.click(screen.getAllByText('New feed')[0]);
    fireEvent.input(await screen.findByLabelText('Name'), {
      target: { value: 'Alarms' },
    });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() =>
      expect(FeedsService.create).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ name: 'Alarms', mode: 'list', keep: 10 })
      )
    );
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith('Feed created')
    );
    expect(navigate).toHaveBeenCalledWith('/org/org-1/feeds/feed-2');
  });

  it('explains the quota and other creation errors', async () => {
    vi.mocked(FeedsService.create)
      .mockRejectedValueOnce(new FeedsError('Quota', 403, 'quota_exceeded'))
      .mockRejectedValueOnce(new FeedsError('name taken', 422));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Facebook posts')).toBeTruthy()
    );

    fireEvent.click(screen.getAllByText('New feed')[0]);
    fireEvent.input(await screen.findByLabelText('Name'), {
      target: { value: 'Alarms' },
    });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        'Your organization has reached its feed limit.'
      )
    );

    fireEvent.click(screen.getByText('Create'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        "Couldn't save the feed: name taken"
      )
    );

    fireEvent.click(screen.getByText('Cancel'));
  });

  it('shows an empty state and hides creation without permission', async () => {
    vi.mocked(FeedsService.list).mockResolvedValue({ data: [], count: 0 });
    allowed = ['list', 'show'];
    renderPage();

    await waitFor(() => expect(screen.getByText(/No feeds yet/)).toBeTruthy());
    expect(screen.queryByText('New feed')).toBeNull();
  });

  it('loads tokens when feed management permission becomes available', async () => {
    const [canManage, setCanManage] = createSignal(false);
    render(() => (
      <I18nProvider>
        <FeedConnect
          organizationId="org-1"
          feed={{
            ...feed,
            used_by: [],
            endpoints: { append: '', replace: '', read: '' },
          }}
          canManage={canManage()}
        />
      </I18nProvider>
    ));

    vi.mocked(FeedsService.tokens).mockResolvedValue([]);
    expect(FeedsService.tokens).not.toHaveBeenCalled();
    setCanManage(true);
    await waitFor(() =>
      expect(FeedsService.tokens).toHaveBeenCalledWith('org-1', 'feed-1')
    );
  });

  it('reports loading errors', async () => {
    vi.mocked(FeedsService.list).mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith("Couldn't load the feeds.")
    );
  });
});

describe('FeedForm', () => {
  it('converts values to attributes', () => {
    expect(
      feedFormToAttrs({
        ...emptyFeedForm(),
        name: ' Posts ',
        description: ' ',
        schema: '{"title": "string"}',
        media_fields: [
          { path: ' image ', mode: 'link' },
          { path: '' },
          { path: 'photos[].url' },
        ],
      })
    ).toEqual({
      attrs: {
        name: 'Posts',
        description: null,
        mode: 'list',
        keep: 10,
        schema: { title: 'string' },
        media_fields: [
          { path: 'image', mode: 'link' },
          { path: 'photos[].url', mode: 'copy' },
        ],
      },
    });

    for (const schema of ['{', '[1]', 'null']) {
      expect(feedFormToAttrs({ ...emptyFeedForm(), schema })).toEqual({
        error: 'feeds.schemaInvalid',
      });
    }
  });

  it('edits media fields and validates the schema', async () => {
    const onSubmit = vi.fn();
    render(() => (
      <I18nProvider>
        <FeedForm
          initial={{
            ...emptyFeedForm(),
            name: 'Posts',
            media_fields: [{ path: 'image', mode: 'copy' }],
          }}
          submitLabel="Save"
          onSubmit={onSubmit}
        />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByText('Add media field'));
    const paths = screen.getAllByLabelText('Path');
    paths[1].focus();
    fireEvent.input(paths[1], { target: { value: 'photos' } });
    expect(paths[1].isConnected).toBe(true);
    expect(document.activeElement).toBe(paths[1]);
    fireEvent.input(paths[1], { target: { value: 'photos[].url' } });
    expect(document.activeElement).toBe(paths[1]);
    fireEvent.change(screen.getAllByLabelText('Handling')[1], {
      target: { value: 'link' },
    });
    fireEvent.click(screen.getAllByText('Remove')[0]);

    fireEvent.input(screen.getByLabelText('Entries to keep'), {
      target: { value: '3' },
    });
    fireEvent.input(screen.getByLabelText('Description'), {
      target: { value: 'News' },
    });
    fireEvent.input(screen.getByLabelText('Entry schema (optional)'), {
      target: { value: '{ bad' },
    });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByRole('alert').textContent).toBe(
      'The schema must be a valid JSON object.'
    );
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.input(screen.getByLabelText('Entry schema (optional)'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'document' },
    });
    expect(screen.queryByLabelText('Entries to keep')).toBeNull();
    fireEvent.click(screen.getByText('Save'));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Posts',
      description: 'News',
      mode: 'document',
      keep: 3,
      schema: null,
      media_fields: [{ path: 'photos[].url', mode: 'link' }],
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
