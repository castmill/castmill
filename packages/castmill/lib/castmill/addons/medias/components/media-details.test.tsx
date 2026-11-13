import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
} from '@solidjs/testing-library';
import { JSX, createSignal } from 'solid-js';
import { ToastProvider } from '@castmill/ui-common';
import type { JsonMedia } from '@castmill/player';
import { MediaDetails } from './media-details';
import { probeDimensions } from './media-dimensions';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('./media-preview', () => ({
  MediaPreview: (props: { previewClass?: string }) => (
    <div data-testid="media-preview" class={props.previewClass} />
  ),
}));

vi.mock('./media-dimensions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./media-dimensions')>()),
  probeDimensions: vi.fn(() => () => {}),
}));

const render = (ui: () => JSX.Element) =>
  baseRender(() => <ToastProvider>{ui()}</ToastProvider>);

const media = {
  id: 42,
  name: 'Original name',
  inserted_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  files: {},
} as unknown as JsonMedia;

const nameInput = () => document.getElementById('name') as HTMLInputElement;

const rename = (value: string) => {
  fireEvent.input(nameInput(), { target: { value } });
};

describe('MediaDetails', () => {
  beforeEach(() => {
    vi.mocked(probeDimensions).mockClear();
  });
  afterEach(cleanup);

  it('renders Save/Reset inline when no actions mount is given', () => {
    render(() => <MediaDetails media={media} onSubmit={vi.fn()} />);

    const form = document.querySelector('form')!;
    const save = screen.getByRole('button', { name: 'common.save' });
    expect(form.contains(save)).toBe(true);
    expect(save).toBeDisabled();
  });

  it('moves the actions to the mount and still submits the form', async () => {
    const footer = document.createElement('footer');
    document.body.appendChild(footer);
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(() => (
      <MediaDetails media={media} onSubmit={onSubmit} actionsMount={footer} />
    ));

    const save = screen.getByRole('button', { name: 'common.save' });
    expect(footer.contains(save)).toBe(true);
    expect(document.querySelector('form')!.contains(save)).toBe(false);
    expect(save).toHaveAttribute('form', document.querySelector('form')!.id);

    rename('Renamed media');
    expect(save).not.toBeDisabled();
    fireEvent.submit(document.querySelector('form')!);
    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Renamed media' })
    );
    await vi.waitFor(() => expect(save).toBeDisabled());
    footer.remove();
  });

  it('resets the name from the footer actions', () => {
    const footer = document.createElement('div');
    document.body.appendChild(footer);
    render(() => (
      <MediaDetails media={media} onSubmit={vi.fn()} actionsMount={footer} />
    ));

    rename('Changed');
    fireEvent.click(screen.getByRole('button', { name: 'common.reset' }));
    expect(nameInput().value).toBe('Original name');
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
    footer.remove();
  });

  it('switches from inline to the mount once it becomes available', () => {
    const [mount, setMount] = createSignal<HTMLElement>();
    const footer = document.createElement('div');
    document.body.appendChild(footer);
    render(() => (
      <MediaDetails media={media} onSubmit={vi.fn()} actionsMount={mount()} />
    ));

    expect(footer.querySelector('button')).toBeNull();
    setMount(footer);
    expect(screen.getAllByRole('button', { name: 'common.save' })).toHaveLength(
      1
    );
    expect(footer.querySelector('button')).not.toBeNull();
    footer.remove();
  });
});

describe('MediaDetails summary and layout', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.mocked(probeDimensions).mockReset();
    vi.mocked(probeDimensions).mockImplementation(() => () => {});
    writeText.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });
  afterEach(cleanup);

  const video = {
    ...media,
    mimetype: 'video/mp4',
    size: 2048,
    meta: { duration: 125000, width: 1920, height: 1080 },
  } as unknown as JsonMedia;

  it('summarises type, size, dimensions, duration and dates', () => {
    render(() => <MediaDetails media={video} onSubmit={vi.fn()} />);

    const summary = screen.getByRole('region', {
      name: 'medias.details.summary',
    });
    expect(summary).toHaveTextContent('medias.details.types.video');
    expect(screen.getByText('2 KB')).toHaveAttribute('title', 'common.size');
    expect(screen.getByText('1920 × 1080')).toHaveAttribute(
      'title',
      'medias.details.dimensions'
    );
    expect(screen.getByText('2:05')).toHaveAttribute(
      'title',
      'medias.details.duration'
    );
    expect(screen.getByText('medias.details.added')).toBeInTheDocument();
    expect(screen.getByText('medias.details.updated')).toBeInTheDocument();
    // Dimensions from metadata skip the browser probe.
    expect(probeDimensions).not.toHaveBeenCalled();
  });

  it('labels images and falls back to the mimetype for other types', () => {
    render(() => (
      <MediaDetails
        media={{ ...media, mimetype: 'image/png' } as JsonMedia}
        onSubmit={vi.fn()}
      />
    ));
    expect(
      screen.getByText('medias.details.types.image', { selector: 'span' })
    ).toHaveAttribute('title', 'image/png');
    cleanup();

    render(() => (
      <MediaDetails
        media={{ ...media, mimetype: 'application/pdf' } as JsonMedia}
        onSubmit={vi.fn()}
      />
    ));
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    cleanup();

    render(() => <MediaDetails media={media} onSubmit={vi.fn()} />);
    expect(screen.getByText('common.notAvailable')).toBeInTheDocument();
  });

  it('shows probed dimensions and cancels the probe on unmount', () => {
    const cancel = vi.fn();
    let report: (value?: { width: number; height: number }) => void = () => {};
    vi.mocked(probeDimensions).mockImplementation((_media, onResult) => {
      report = onResult;
      return cancel;
    });

    const { unmount } = render(() => (
      <MediaDetails media={media} onSubmit={vi.fn()} />
    ));
    expect(probeDimensions).toHaveBeenCalledWith(media, expect.any(Function));
    expect(screen.queryByText(/×/)).toBeNull();

    report({ width: 800, height: 600 });
    expect(screen.getByText('800 × 600')).toBeInTheDocument();

    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it('copies the media ID', async () => {
    render(() => <MediaDetails media={media} onSubmit={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'medias.details.copyId' })
    );
    expect(writeText).toHaveBeenCalledWith('42');
    await vi.waitFor(() =>
      expect(screen.getByText('medias.details.copied')).toBeInTheDocument()
    );
  });

  it('reports copy failures with a toast', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(() => <MediaDetails media={media} onSubmit={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'medias.details.copyId' })
    );
    await vi.waitFor(() =>
      expect(screen.getByText('medias.details.copyFailed')).toBeInTheDocument()
    );
  });

  it('places the preview before the form inside the responsive layout', () => {
    render(() => <MediaDetails media={media} onSubmit={vi.fn()} />);

    const layout = document.querySelector('.media-details-layout')!;
    expect(layout.parentElement).toHaveClass('media-details');
    const [preview, form] = Array.from(layout.children);
    expect(preview).toBe(screen.getByTestId('media-preview'));
    expect(preview).toHaveClass('media-details-preview');
    expect(form).toHaveClass('media-details-form');
    expect(form.querySelector('form')).not.toBeNull();
  });

  it('lays out preview and form side by side in wide drawers', () => {
    const css = readFileSync(resolve(__dirname, 'medias.scss'), 'utf8').replace(
      /\s+/g,
      ' '
    );
    expect(css).toContain('container: media-details / inline-size');
    const wide = css.slice(
      css.indexOf('@container media-details (min-width: 54em)')
    );
    expect(wide).toMatch(/\.media-details-layout \{ flex-direction: row;/);
    expect(wide).toMatch(/max-height: calc\(100dvh - 20em\)/);
    expect(css).toMatch(/object-fit: contain/);
  });

  it('localizes name validation and the placeholder', () => {
    render(() => <MediaDetails media={media} onSubmit={vi.fn()} />);

    expect(nameInput()).toHaveAttribute(
      'placeholder',
      'medias.details.namePlaceholder'
    );
    rename('');
    expect(screen.getByText('medias.details.nameRequired')).toBeInTheDocument();
    rename('abc');
    expect(screen.getByText('medias.details.nameTooShort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
  });

  it('uses the store translations and locale', () => {
    const store = {
      i18n: {
        t: (key: string, params?: Record<string, any>) =>
          key === 'medias.details.updated' ? `Updated ${params?.time}` : key,
        locale: () => 'en',
      },
    } as any;
    render(() => (
      <MediaDetails media={media} store={store} onSubmit={vi.fn()} />
    ));
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });
});
