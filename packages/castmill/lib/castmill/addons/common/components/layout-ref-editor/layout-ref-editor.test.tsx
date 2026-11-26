import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LayoutRefValue } from '@castmill/player';
import { authFetch } from '../../services/auth-fetch';
import { LayoutRefEditor } from './layout-ref-editor';

vi.mock('../../services/auth-fetch', () => ({ authFetch: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const zones = Array.from({ length: 3 }, (_, index) => ({
  id: `zone-${index + 1}`,
  name: `Zone ${index + 1}`,
  rect: { x: index * 33, y: 0, width: 33, height: 100 },
  zIndex: index,
}));

const value: LayoutRefValue = {
  layoutId: 42,
  aspectRatio: '16:9',
  zones: { zones },
  zonePlaylistMap: {
    'zone-3': {
      playlistId: 7,
      playlist: { id: 7, name: 'Third zone playlist' },
    },
  },
};

describe('LayoutRefEditor restoration', () => {
  it('loads metadata by ID and preserves the saved geometry when editing assignments', async () => {
    vi.mocked(authFetch).mockImplementation(async (url) => {
      const layout = {
        id: 42,
        name: 'Landscape 3 Zones',
        description: null,
        aspect_ratio: '9:16',
        zones: { zones: [{ ...zones[0], id: 'new-zone', name: 'New zone' }] },
      };
      return new Response(
        JSON.stringify(
          String(url).endsWith('/layouts/42')
            ? { data: layout }
            : {
                data: [
                  {
                    ...layout,
                    id: 1,
                    name: '2layout',
                    zones: { zones: zones.slice(0, 2) },
                  },
                ],
                count: 2,
              }
        ),
        { status: 200 }
      );
    });
    const onChange = vi.fn();
    const { container } = render(() => (
      <LayoutRefEditor
        value={value}
        onChange={onChange}
        organizationId="org-1"
        baseUrl="https://castmill.example"
        t={(key) => key}
      />
    ));

    await screen.findByText('Landscape 3 Zones');
    expect(authFetch).toHaveBeenCalledWith(
      'https://castmill.example/dashboard/organizations/org-1/layouts/42',
      expect.objectContaining({ method: 'GET' })
    );
    expect(screen.queryByText('2layout')).toBeNull();
    expect(screen.queryByText('New zone')).toBeNull();
    expect(container.querySelectorAll('.layout-ref-editor__zone')).toHaveLength(
      3
    );
    expect(
      container.querySelectorAll('.layout-ref-editor__zone-assignment')
    ).toHaveLength(3);
    expect(screen.getAllByText('Third zone playlist')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'common.remove' }));
    expect(onChange).toHaveBeenCalledWith({ ...value, zonePlaylistMap: {} });
  });

  it('reports a failed saved-layout lookup without selecting another layout or changing the value', async () => {
    vi.mocked(authFetch).mockImplementation(async (url) =>
      String(url).endsWith('/layouts/42')
        ? new Response(
            JSON.stringify({ errors: { detail: 'Layout not found' } }),
            { status: 404 }
          )
        : new Response(JSON.stringify({ data: [], count: 0 }), { status: 200 })
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onChange = vi.fn();
    const { container } = render(() => (
      <LayoutRefEditor
        value={value}
        onChange={onChange}
        organizationId="org-1"
        baseUrl="https://castmill.example"
        t={(key) => key}
      />
    ));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Failed to fetch layout:',
        expect.objectContaining({ message: 'Layout not found' })
      )
    );
    expect(
      container.querySelector('.layout-ref-editor__selected-layout')
    ).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
