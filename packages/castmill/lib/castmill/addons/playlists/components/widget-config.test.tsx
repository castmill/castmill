import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import type { JsonPlaylistItem } from '@castmill/player';
import { ToastProvider } from '@castmill/ui-common';
import { WidgetConfig } from './widget-config';

// The preview shows an editable text, except when rotating through listings.
vi.mock('./widget-view', () => ({
  WidgetView: (props: { options?: Record<string, unknown> }) => (
    <div
      data-testid="widget-view"
      data-options={JSON.stringify(props.options || {})}
    >
      {props.options?.mode === 'listing' && (
        <span data-editable-key="title" data-editable-label="Title">
          Title
        </span>
      )}
    </div>
  ),
}));

const item = (id?: number) =>
  ({
    id,
    duration: 10000,
    widget: {
      id: 1,
      name: 'Text',
      options_schema: { text: { type: 'string', required: true } },
    },
    config: { options: { text: 'Hello' } },
  }) as unknown as JsonPlaylistItem;

const renderConfig = (overrides: Record<string, unknown> = {}) => {
  const props = {
    store: { i18n: { t: (key: string) => key, locale: () => 'en' } } as any,
    baseUrl: 'http://localhost:4000',
    organizationId: 'org-1',
    playlistId: 1,
    item: item(5),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onDirtyChange: vi.fn(),
    ...overrides,
  };
  render(() => (
    <ToastProvider>
      <WidgetConfig {...(props as any)} />
    </ToastProvider>
  ));
  return props;
};

const button = (name: string) => screen.getByRole('button', { name });

describe('WidgetConfig footer', () => {
  it('saves an existing item only after it has been edited', async () => {
    const props = renderConfig();

    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
    expect(button('common.save')).toBeDisabled();

    fireEvent.input(screen.getByDisplayValue('Hello'), {
      target: { value: 'Hi' },
    });

    await waitFor(() => expect(button('common.save')).toBeEnabled());
    expect(
      screen.getByText('playlists.editor.unsavedChanges')
    ).toBeInTheDocument();
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('offers to add a new item without requiring edits', () => {
    renderConfig({ item: item() });

    expect(button('playlists.editor.addToPlaylist')).toBeEnabled();
    expect(screen.queryByText('playlists.editor.unsavedChanges')).toBeNull();
  });

  it('cancels through the onCancel callback', () => {
    const props = renderConfig();

    fireEvent.click(button('common.cancel'));

    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe('WidgetConfig conditional fields', () => {
  const conditionalItem = (
    id?: number,
    options: Record<string, unknown> = {}
  ) =>
    ({
      id,
      duration: 10000,
      widget: {
        id: 2,
        name: 'Listing',
        options_schema: {
          mode: {
            type: 'string',
            enum: ['listing', 'listings'],
            default: 'listing',
            order: 1,
          },
          title: {
            type: 'string',
            required: true,
            visible_when: { mode: ['listing'] },
            order: 2,
          },
          max_listings: {
            type: 'number',
            default: 10,
            visible_when: { mode: ['listings'] },
            order: 3,
          },
        },
        translations: {
          en: {
            options: {
              mode: {
                values: {
                  listing: 'A specific listing',
                  listings: 'Our listings',
                },
              },
            },
          },
        },
      },
      config: { options },
    }) as unknown as JsonPlaylistItem;

  const field = (id: string) => document.getElementById(id);

  it('labels enum values from the widget translations', () => {
    renderConfig({ item: conditionalItem() });

    expect(
      screen.getByRole('option', { name: 'A specific listing' })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Our listings' })).toHaveValue(
      'listings'
    );
  });

  it('shows fields for the selected mode and requires only those', async () => {
    renderConfig({ item: conditionalItem() });

    expect(field('title')).not.toBeNull();
    expect(field('max_listings')).toBeNull();
    await waitFor(() =>
      expect(button('playlists.editor.addToPlaylist')).toBeDisabled()
    );

    fireEvent.change(field('mode')!, { target: { value: 'listings' } });

    await waitFor(() => expect(field('title')).toBeNull());
    expect(field('max_listings')).toHaveValue(10);
    await waitFor(() =>
      expect(button('playlists.editor.addToPlaylist')).toBeEnabled()
    );
  });

  it('keeps a field mounted while typing', () => {
    renderConfig({
      item: conditionalItem(5, { mode: 'listing', title: 'Initial title' }),
    });

    const title = field('title') as HTMLInputElement;
    title.focus();
    fireEvent.input(title, { target: { value: 'Updated title' } });

    expect(document.activeElement).toBe(title);
    expect(field('title')).toBe(title);
    expect(title).toHaveValue('Updated title');
  });

  it('filters hidden options from the preview', async () => {
    renderConfig({
      item: conditionalItem(5, {
        mode: 'listing',
        title: 'Visible title',
        max_listings: 9,
      }),
    });
    const previewOptions = () =>
      JSON.parse(
        screen.getByTestId('widget-view').getAttribute('data-options') || '{}'
      );

    expect(previewOptions()).toMatchObject({
      mode: 'listing',
      title: 'Visible title',
    });
    expect(previewOptions()).not.toHaveProperty('max_listings');

    fireEvent.change(field('mode')!, { target: { value: 'listings' } });
    await waitFor(() =>
      expect(previewOptions()).toMatchObject({
        mode: 'listings',
        max_listings: 9,
      })
    );
    expect(previewOptions()).not.toHaveProperty('title');
  });

  it('does not save the values of hidden fields', async () => {
    const props = renderConfig({
      item: conditionalItem(5, { mode: 'listing', title: 'Strandvägen 32' }),
    });

    fireEvent.change(field('mode')!, { target: { value: 'listings' } });
    await waitFor(() => expect(button('common.save')).toBeEnabled());
    fireEvent.click(button('common.save'));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    const [{ config, expandedOptions }] = props.onSubmit.mock.calls[0];
    expect(config.options).toEqual({ mode: 'listings', max_listings: 10 });
    expect(expandedOptions).toEqual({ mode: 'listings', max_listings: 10 });

    // Switching back before saving again restores the edited value.
    fireEvent.change(field('mode')!, { target: { value: 'listing' } });
    await waitFor(() => expect(field('title')).toHaveValue('Strandvägen 32'));
  });
});

describe('WidgetConfig text editing toolbar', () => {
  const editableItem = () =>
    ({
      id: 7,
      duration: 10000,
      widget: {
        id: 3,
        name: 'Listing',
        template: {
          type: 'text',
          name: 'title',
          opts: { text: 'Title' },
          editable: { key: 'title', label: 'Title' },
        },
        options_schema: {
          mode: { type: 'string', enum: ['listing', 'listings'] },
        },
      },
      config: { options: { mode: 'listing' } },
    }) as unknown as JsonPlaylistItem;

  it('offers to edit texts only while the preview shows editable texts', async () => {
    renderConfig({ item: editableItem() });

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'widgets.editableTexts.editTexts' })
      ).toBeInTheDocument()
    );

    fireEvent.change(document.getElementById('mode')!, {
      target: { value: 'listings' },
    });

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: 'widgets.editableTexts.editTexts',
        })
      ).toBeNull()
    );
  });
});
