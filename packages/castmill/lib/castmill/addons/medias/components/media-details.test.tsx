import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { JsonMedia } from '@castmill/player';
import { MediaDetails } from './media-details';

vi.mock('./media-preview', () => ({
  MediaPreview: () => <div data-testid="media-preview" />,
}));

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
