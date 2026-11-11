import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import type { JsonPlaylistItem } from '@castmill/player';
import { ToastProvider } from '@castmill/ui-common';
import { WidgetConfig } from './widget-config';

vi.mock('./widget-view', () => ({
  WidgetView: () => <div data-testid="widget-view" />,
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
