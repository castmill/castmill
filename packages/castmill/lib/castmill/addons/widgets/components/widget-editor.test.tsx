// @vitest-environment jsdom

import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { WidgetEditor } from './widget-editor';

const previewState = vi.hoisted(() => ({ mounts: 0 }));

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
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../playlists/components/widget-view', () => ({
  WidgetView: (props: any) => {
    const mount = ++previewState.mounts;
    return (
      <div data-testid="widget-preview" data-mount={mount}>
        {JSON.stringify(props.widget.template)}
      </div>
    );
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
});
