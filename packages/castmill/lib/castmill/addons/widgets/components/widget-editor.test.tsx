// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetEditor } from './widget-editor';

const previewState = vi.hoisted(() => ({
  mounts: 0,
  showToast: vi.fn(),
  createFromJson: vi.fn(),
}));

vi.mock('@castmill/ui-common', () => ({
  Button: (props: any) => (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.label}
    </button>
  ),
  useToast: () => ({
    showToast: previewState.showToast,
  }),
}));

vi.mock('../../playlists/components/widget-view', () => ({
  WidgetView: (props: any) => {
    const mount = ++previewState.mounts;
    return (
      <div data-testid="widget-preview" data-mount={mount}>
        {JSON.stringify({
          template: props.widget.template,
          assets: props.widget.assets,
          fonts: props.widget.fonts,
        })}
      </div>
    );
  },
}));

vi.mock('../services/widgets.service', () => ({
  WidgetsService: {
    createFromJson: previewState.createFromJson,
  },
}));

const store = {
  env: { baseUrl: 'http://localhost' },
  organizations: { selectedId: 'organization-id' },
  i18n: {
    t: (key: string, params?: Record<string, string>) =>
      params?.path ? `${key}: ${params.path}` : key,
  },
} as any;

describe('WidgetEditor', () => {
  beforeEach(() => {
    previewState.showToast.mockClear();
    previewState.createFromJson.mockReset();
  });

  it('updates the rendered preview when the template changes', () => {
    render(() => (
      <WidgetEditor store={store} onSave={vi.fn()} onCancel={vi.fn()} />
    ));

    const initialMount = screen
      .getByTestId('widget-preview')
      .getAttribute('data-mount');
    fireEvent.click(screen.getByText('widgets.template'));
    fireEvent.input(
      screen.getByPlaceholderText('widgets.editor.templatePlaceholder'),
      {
        target: {
          value: JSON.stringify({
            type: 'text',
            name: 'updated',
            opts: { text: 'Updated preview' },
          }),
        },
      }
    );

    expect(screen.getByTestId('widget-preview').textContent).toContain(
      'Updated preview'
    );
    expect(
      screen.getByTestId('widget-preview').getAttribute('data-mount')
    ).not.toBe(initialMount);
  });

  it('shows the invalid component path and prevents saving', () => {
    render(() => (
      <WidgetEditor store={store} onSave={vi.fn()} onCancel={vi.fn()} />
    ));

    fireEvent.click(screen.getByText('widgets.template'));
    fireEvent.input(
      screen.getByPlaceholderText('widgets.editor.templatePlaceholder'),
      {
        target: {
          value: JSON.stringify({
            type: 'group',
            name: 'root',
            components: [{ type: 'unknown', name: 'invalid', opts: {} }],
          }),
        },
      }
    );

    expect(
      screen.getByText('widgets.editor.invalidTemplate: template.components[0]')
    ).not.toBeNull();
    expect(
      screen.getByText('widgets.editor.createWidget').hasAttribute('disabled')
    ).toBe(true);
    expect(screen.queryByTestId('widget-preview')).toBeNull();
  });

  it('includes edited assets in the live preview', () => {
    render(() => (
      <WidgetEditor store={store} onSave={vi.fn()} onCancel={vi.fn()} />
    ));

    fireEvent.click(screen.getByText('widgets.assets.title'));
    fireEvent.input(screen.getByPlaceholderText('{"images": {}}'), {
      target: {
        value: JSON.stringify({
          images: {
            background: {
              path: 'https://example.com/background.png',
              type: 'image/png',
            },
          },
        }),
      },
    });

    expect(screen.getByTestId('widget-preview').textContent).toContain(
      'https://example.com/background.png'
    );
  });

  it('edits positioned components nested in collection templates', () => {
    render(() => (
      <WidgetEditor
        store={store}
        widget={
          {
            id: 1,
            name: 'Feed',
            slug: 'feed',
            template: {
              type: 'paginated-list',
              name: 'posts',
              opts: {
                items: { key: 'data.posts' },
                pageSize: 1,
                pageDuration: 8,
              },
              style: { width: '100%', height: '100%' },
              component: {
                type: 'image',
                name: 'post-media',
                opts: { url: { key: '$.media_url' }, size: 'cover' },
                style: {
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '100%',
                  height: '100%',
                },
              },
            },
            options_schema: {},
            data_schema: {},
          } as any
        }
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    ));

    fireEvent.click(screen.getByText('post-media'));
    fireEvent.input(screen.getByLabelText('widgets.editor.top'), {
      target: { value: '2em' },
    });

    expect(screen.getByTestId('widget-preview').textContent).toContain(
      '"top":"2em"'
    );
    expect(
      (screen.getByLabelText('widgets.editor.position') as HTMLSelectElement)
        .value
    ).toBe('absolute');

    fireEvent.click(screen.getByText('widgets.editor.advanced'));
    fireEvent.input(screen.getByLabelText('widgets.editor.componentStyles'), {
      target: {
        value: JSON.stringify({
          position: 'absolute',
          top: '2em',
          background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
          'pointer-events': 'none',
        }),
      },
    });

    expect(screen.getByTestId('widget-preview').textContent).toContain(
      'linear-gradient'
    );
    expect(screen.getByTestId('widget-preview').textContent).toContain(
      'pointer-events'
    );
  });

  it('uses the supported toast API when saving a fixture', () => {
    render(() => (
      <WidgetEditor store={store} onSave={vi.fn()} onCancel={vi.fn()} />
    ));

    fireEvent.click(screen.getByText('widgets.editor.fixture'));
    fireEvent.input(
      screen.getByPlaceholderText('widgets.editor.fixtureNamePlaceholder'),
      { target: { value: 'Example' } }
    );
    fireEvent.click(screen.getByText('widgets.editor.saveFixture'));

    expect(previewState.showToast).toHaveBeenCalledWith(
      'widgets.editor.fixtureSaved',
      'success',
      2000
    );
  });

  it('saves asset manifests and fonts with the widget', async () => {
    previewState.createFromJson.mockResolvedValue({ name: 'Asset widget' });
    render(() => (
      <WidgetEditor store={store} onSave={vi.fn()} onCancel={vi.fn()} />
    ));

    fireEvent.input(
      screen.getByPlaceholderText('widgets.editor.namePlaceholder'),
      { target: { value: 'Asset widget' } }
    );
    fireEvent.click(screen.getByText('widgets.assets.title'));
    fireEvent.input(screen.getByPlaceholderText('{"images": {}}'), {
      target: {
        value: JSON.stringify({
          images: {
            logo: { path: 'https://example.com/logo.png', type: 'image/png' },
          },
        }),
      },
    });
    fireEvent.click(screen.getByText('widgets.assets.fonts'));
    fireEvent.input(screen.getByPlaceholderText('[{"name": "", "url": ""}]'), {
      target: {
        value: JSON.stringify([
          { name: 'Brand Font', url: 'https://example.com/font.woff2' },
        ]),
      },
    });
    fireEvent.click(screen.getByText('widgets.editor.createWidget'));

    await waitFor(() => {
      expect(previewState.createFromJson).toHaveBeenCalledWith(
        'http://localhost',
        'organization-id',
        expect.objectContaining({
          assets: {
            images: {
              logo: {
                path: 'https://example.com/logo.png',
                type: 'image/png',
              },
            },
          },
          fonts: [
            {
              name: 'Brand Font',
              url: 'https://example.com/font.woff2',
            },
          ],
        })
      );
    });
  });
});
