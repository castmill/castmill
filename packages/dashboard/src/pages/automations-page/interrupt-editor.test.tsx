import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { I18nProvider } from '../../i18n';
import type { InterruptConfig } from '../../services/automations.service';
import { InterruptEditor } from './actions/interrupt-editor';
import {
  DEFAULT_MAX_WAIT_SECONDS,
  defaultInterruptConfig,
  validateInterrupt,
} from './actions/interrupt-logic';

const fetchPlaylists = vi.fn();

vi.mock('../../services/channels.service', () => ({
  ChannelsService: class {
    fetchPlaylists = fetchPlaylists;
    fetchPlaylist = vi
      .fn()
      .mockResolvedValue({ data: { id: 7, name: 'Lunch menu' } });
  },
}));
vi.mock('../../components/auth', () => ({ authFetch: vi.fn() }));
vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children as string}
    </a>
  ),
}));

let current: () => InterruptConfig;

const renderEditor = (initial: InterruptConfig = defaultInterruptConfig()) => {
  const [config, setConfig] = createSignal<InterruptConfig>(initial);
  current = config;
  render(() => (
    <I18nProvider>
      <InterruptEditor
        config={config()}
        onChange={setConfig}
        organizationId="org-1"
        errors={validateInterrupt(config())}
      />
    </I18nProvider>
  ));
};

describe('InterruptEditor', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('chooses a playlist through the searchable combo box', async () => {
    fetchPlaylists.mockResolvedValue({
      count: 1,
      data: [{ id: 12, name: 'Spring offer' }],
    });
    renderEditor();
    expect(screen.getByText('Choose a playlist.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create a playlist' })
    ).toHaveAttribute('href', '/org/org-1/content/playlists');

    fireEvent.click(screen.getByText('Search for a playlist…'));
    fireEvent.click(await screen.findByText('Spring offer'));
    expect(current().playlist_id).toBe(12);
    expect(fetchPlaylists).toHaveBeenCalledWith(
      expect.objectContaining({
        sortOptions: { key: 'name', direction: 'ascending' },
      })
    );
    await waitFor(() =>
      expect(screen.queryByText('Choose a playlist.')).not.toBeInTheDocument()
    );
  });

  it('shows the playlist name of an existing selection', async () => {
    renderEditor({ ...defaultInterruptConfig(), playlist_id: 7 });
    await waitFor(() =>
      expect(screen.getByText('Lunch menu')).toBeInTheDocument()
    );
  });

  it('only shows the maximum wait for after_current_item', () => {
    renderEditor();
    expect(screen.getByLabelText(/After the current item/)).toBeChecked();
    expect(
      screen.getByRole('spinbutton', { name: /Maximum wait/ })
    ).toHaveValue(DEFAULT_MAX_WAIT_SECONDS);

    fireEvent.input(screen.getByRole('spinbutton', { name: /Maximum wait/ }), {
      target: { value: '30' },
    });
    expect(current().max_wait_seconds).toBe(30);

    fireEvent.click(screen.getByLabelText(/Immediately/));
    expect(current().start).toBe('immediately');
    expect(
      screen.queryByRole('spinbutton', { name: /Maximum wait/ })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/After the current item/));
    expect(current()).toMatchObject({
      start: 'after_current_item',
      max_wait_seconds: 30,
    });
  });

  it('defaults the maximum wait when switching back without a value', () => {
    renderEditor({
      playlist_id: 1,
      start: 'immediately',
      plays: 1,
      priority: 'normal',
    });
    fireEvent.click(screen.getByLabelText(/After the current item/));
    expect(current().max_wait_seconds).toBe(DEFAULT_MAX_WAIT_SECONDS);
  });

  it('edits plays and priority and shows validation errors', () => {
    renderEditor({ ...defaultInterruptConfig(), playlist_id: 1 });
    const plays = screen.getByRole('spinbutton', { name: /Plays/ });
    fireEvent.input(plays, { target: { value: '3' } });
    expect(current().plays).toBe(3);
    fireEvent.input(plays, { target: { value: '' } });
    expect(current().plays).toBeNaN();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/^High/));
    expect(current().priority).toBe('high');
  });
});
