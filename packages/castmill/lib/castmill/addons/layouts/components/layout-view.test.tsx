import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutView } from './layout-view';
import { LayoutsService } from '../services/layouts.service';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@castmill/ui-common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@castmill/ui-common')>()),
  useToast: () => toast,
}));
vi.mock('../services/layouts.service', () => ({
  LayoutsService: { updateLayout: vi.fn() },
}));

const editorProps = vi.hoisted(() => ({ current: undefined as any }));
vi.mock('../../common/components/layout-editor', () => ({
  LayoutEditor: (props: any) => {
    editorProps.current = props;
    return <div data-testid="layout-editor" />;
  },
}));

const layout = {
  id: 7,
  name: 'Lobby',
  description: 'Main hall',
  aspect_ratio: '16:9',
  zones: {
    zones: [
      {
        id: 'z1',
        name: 'Zone 1',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        zIndex: 1,
      },
    ],
  },
} as any;

const store = {
  env: { baseUrl: 'http://api' },
  organizations: { selectedId: 'org-1' },
  i18n: { t: (key: string) => `tr:${key}` },
} as any;

const renderView = (actionsMount?: HTMLElement) => {
  const onUpdate = vi.fn();
  const result = render(() => (
    <LayoutView
      layout={layout}
      store={store}
      onUpdate={onUpdate}
      onClose={vi.fn()}
      actionsMount={actionsMount}
    />
  ));
  return { ...result, onUpdate };
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('LayoutView', () => {
  it('renders the details form, editor and a footer save bar', () => {
    const { container } = renderView();
    const header = container.querySelector('.layout-view-header')!;
    const footer = container.querySelector('.layout-view-footer')!;

    expect(header.querySelector('#layout-name')).toHaveValue('Lobby');
    expect(header.querySelector('#layout-description')).toHaveValue(
      'Main hall'
    );
    // Save lives in the footer, after the editor, not in the header
    expect(header.querySelector('button')).toBeNull();
    const save = footer.querySelector('button')!;
    expect(save).toHaveTextContent('tr:common.save');
    expect(save).toBeDisabled();
    expect(
      screen.getByTestId('layout-editor').compareDocumentPosition(footer) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // The editor receives the dashboard translation function
    expect(editorProps.current.t('x')).toBe('tr:x');
  });

  it('marks unsaved changes and saves from the footer', async () => {
    vi.mocked(LayoutsService.updateLayout).mockResolvedValue({
      ...layout,
      name: 'Lobby 2',
    });
    const { container, onUpdate } = renderView();
    const view = container.querySelector('.layout-view')!;
    expect(view).not.toHaveClass('is-dirty');
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.input(container.querySelector('#layout-name')!, {
      target: { value: 'Lobby 2' },
    });

    expect(view).toHaveClass('is-dirty');
    expect(screen.getByRole('status')).toHaveTextContent(
      'tr:layouts.unsavedChanges'
    );
    const save = container.querySelector(
      '.layout-view-footer button'
    ) as HTMLButtonElement;
    expect(save).toBeEnabled();

    fireEvent.click(save);
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled());

    expect(LayoutsService.updateLayout).toHaveBeenCalledWith(
      'http://api',
      'org-1',
      7,
      expect.objectContaining({ name: 'Lobby 2', aspect_ratio: '16:9' })
    );
    expect(toast.success).toHaveBeenCalledWith('tr:layouts.saveSuccess');
    expect(view).not.toHaveClass('is-dirty');
  });

  it('portals the save bar into the drawer footer when mounted', () => {
    const footer = document.createElement('div');
    document.body.appendChild(footer);
    const { container } = renderView(footer);

    expect(container.querySelector('.layout-view-footer')).toBeNull();
    const save = footer.querySelector(
      '.layout-view-actions button'
    ) as HTMLButtonElement;
    expect(save).toHaveTextContent('tr:common.save');
    expect(save).toBeDisabled();

    fireEvent.input(container.querySelector('#layout-description')!, {
      target: { value: 'Updated' },
    });
    expect(save).toBeEnabled();
    expect(footer).toHaveTextContent('tr:layouts.unsavedChanges');
    footer.remove();
  });

  it('tracks zone edits from the editor', () => {
    const { container } = renderView();
    editorProps.current.onChange({
      aspectRatio: '9:16',
      zones: editorProps.current.value.zones,
    });
    expect(container.querySelector('.layout-view')).toHaveClass('is-dirty');
  });
});
