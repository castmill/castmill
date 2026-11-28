import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
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

const mediaUploadProps = vi.hoisted(() => ({ current: undefined as any }));

// The in-place upload has its own tests (media-upload.test.tsx).
vi.mock('./media-upload', () => ({
  MediaUpload: (props: any) => {
    mediaUploadProps.current = props;
    return <button type="button">{props.label}</button>;
  },
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

describe('WidgetConfig unsupported option types', () => {
  const withSchema = (
    options_schema: Record<string, unknown>,
    options: Record<string, unknown> = {}
  ) =>
    ({
      duration: 10000,
      widget: { id: 1, name: 'Places', options_schema },
      config: { options },
    }) as unknown as JsonPlaylistItem;

  it('skips optional options it cannot edit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderConfig({
      item: withSchema({
        title: { type: 'string', required: true },
        city: { type: 'city' },
      }),
    });

    expect(screen.getByText('title')).toBeInTheDocument();
    warn.mockRestore();
  });

  it('skips required ones that have a value or a default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderConfig({
      item: withSchema(
        {
          city: { type: 'city', required: true },
          area: { type: 'area', required: true, default: 'north' },
        },
        { city: 'Lund' }
      ),
    });

    expect(button('playlists.editor.addToPlaylist')).toBeEnabled();
    warn.mockRestore();
  });

  // Submit could never be enabled: the playlist editor's error boundary
  // explains it instead.
  it('fails on a required one without a value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() =>
      renderConfig({
        item: withSchema({ city: { type: 'city', required: true } }),
      })
    ).toThrow(/"city" is required but has an unsupported type/);
    warn.mockRestore();
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

describe('WidgetConfig media upload', () => {
  const imageItem = () =>
    ({
      duration: 10000,
      widget: {
        id: 4,
        name: 'Image',
        options_schema: {
          image: {
            type: 'ref',
            collection: 'medias|type:image',
            required: true,
          },
        },
      },
      config: { options: {} },
    }) as unknown as JsonPlaylistItem;

  const canCreateMedias = {
    i18n: { t: (key: string) => key, locale: () => 'en' },
    permissions: { role: 'regular', matrix: { medias: ['list', 'create'] } },
  };

  const previewOptions = () =>
    JSON.parse(
      screen.getByTestId('widget-view').getAttribute('data-options') || '{}'
    );

  const uploaded = (overrides: Record<string, unknown> = {}) => ({
    id: 42,
    name: 'beach',
    mimetype: 'image/png',
    status: 'uploading',
    files: {},
    ...overrides,
  });

  beforeEach(() => {
    mediaUploadProps.current = undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ data: [], count: 0 }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not offered to users who cannot add medias', () => {
    renderConfig({ item: imageItem() });

    expect(
      screen.queryByRole('button', {
        name: 'playlists.mediaUpload.uploadImage',
      })
    ).toBeNull();
  });

  it('selects the uploaded image and reports it to the playlist view', async () => {
    const onMediaUpload = vi.fn();
    renderConfig({
      item: imageItem(),
      store: canCreateMedias,
      onMediaUpload,
    });

    expect(
      screen.getByRole('button', { name: 'playlists.mediaUpload.uploadImage' })
    ).toBeInTheDocument();
    expect(mediaUploadProps.current.mediaType).toBe('image');
    expect(mediaUploadProps.current.organizationId).toBe('org-1');
    expect(button('playlists.editor.addToPlaylist')).toBeDisabled();

    const uploadedMedia = uploaded();
    mediaUploadProps.current.onUpload(uploadedMedia);

    await waitFor(() => expect(previewOptions().image.id).toBe(42));
    expect(button('playlists.editor.addToPlaylist')).toBeEnabled();
    expect(onMediaUpload).toHaveBeenCalledWith(uploadedMedia);
  });

  it('keeps another media chosen after the upload', async () => {
    renderConfig({ item: imageItem(), store: canCreateMedias });

    mediaUploadProps.current.onUpload(uploaded({ id: 7 }));
    await waitFor(() => expect(previewOptions().image.id).toBe(7));

    expect(previewOptions().image).toEqual(uploaded({ id: 7 }));
  });

  it('refreshes only the selected uploaded media when processing finishes', async () => {
    const [processedMedias, setProcessedMedias] = createSignal<
      Map<number, ReturnType<typeof uploaded>>
    >(new Map());
    renderConfig({
      item: imageItem(),
      store: canCreateMedias,
      processedMedias,
    });

    mediaUploadProps.current.onUpload(uploaded());
    await waitFor(() => expect(previewOptions().image.id).toBe(42));

    const readyMedia = uploaded({
      status: 'ready',
      files: { thumbnail: { uri: 'thumbnail.png' } },
    });
    setProcessedMedias(new Map([[42, readyMedia]]));
    await waitFor(() => expect(previewOptions().image).toEqual(readyMedia));

    mediaUploadProps.current.onUpload(uploaded({ id: 7 }));
    await waitFor(() => expect(previewOptions().image.id).toBe(7));
    setProcessedMedias(new Map([[42, uploaded({ id: 42, status: 'ready' })]]));

    expect(previewOptions().image).toEqual(uploaded({ id: 7 }));
  });
});
