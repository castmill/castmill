import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';

import type { JsonPlaylist } from '@castmill/player';

import { PlaylistNameField } from './playlist-details';

describe('PlaylistNameField', () => {
  it('resets the draft and validation when the playlist changes', async () => {
    let setPlaylist!: (playlist: JsonPlaylist) => void;
    const firstPlaylist = {
      id: 1,
      name: 'First playlist',
      status: 'live',
      items: [],
    } as JsonPlaylist;
    const secondPlaylist = {
      ...firstPlaylist,
      id: 2,
      name: 'Second playlist',
    };
    const onSubmit = vi.fn(async () => false);

    render(() => {
      const [playlist, updatePlaylist] = createSignal(firstPlaylist);
      setPlaylist = updatePlaylist;
      return (
        <PlaylistNameField
          playlist={playlist()}
          t={(key) => key}
          onSubmit={onSubmit}
        />
      );
    });

    const input = screen.getByLabelText('common.name') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'ab' } });
    expect(screen.getByText('playlists.errors.nameMinLength')).toBeTruthy();

    setPlaylist(secondPlaylist);

    await waitFor(() => expect(input.value).toBe('Second playlist'));
    expect(screen.queryByText('playlists.errors.nameMinLength')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
