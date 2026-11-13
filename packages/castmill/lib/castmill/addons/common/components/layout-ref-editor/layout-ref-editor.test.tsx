import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library';
import { LayoutRefEditor } from './layout-ref-editor';
import { ResourcesService } from '../../../playlists/services/resources.service';

vi.mock('@castmill/ui-common', () => ({
  ComboBox: (props: { id: string }) => <input data-testid={props.id} />,
  Button: (props: { label: string; onClick: () => void }) => (
    <button onClick={props.onClick}>{props.label}</button>
  ),
}));
vi.mock('../../../playlists/services/resources.service', () => ({
  ResourcesService: { fetch: vi.fn() },
}));
vi.mock('../../../playlists/services/playlists.service', () => ({
  PlaylistsService: {},
}));

const layout = {
  id: 7,
  name: 'Split',
  aspect_ratio: '16:9',
  zones: {
    zones: [
      {
        id: 'left',
        name: 'Left',
        rect: { x: 0, y: 0, width: 50, height: 100 },
        zIndex: 1,
      },
      {
        id: 'right',
        name: 'Right',
        rect: { x: 50, y: 0, width: 50, height: 100 },
        zIndex: 1,
      },
    ],
  },
};

describe('LayoutRefEditor zone highlight', () => {
  afterEach(cleanup);

  it('highlights a zone while its assignment row has keyboard/touch focus', async () => {
    vi.mocked(ResourcesService.fetch).mockResolvedValue({
      data: [layout],
      count: 1,
    } as never);

    const { container } = render(() => (
      <LayoutRefEditor
        value={{ layoutId: 7 } as never}
        onChange={vi.fn()}
        organizationId="org-1"
        baseUrl="http://test.local"
      />
    ));

    const rows = await waitFor(() => {
      const found = container.querySelectorAll(
        '.layout-ref-editor__zone-assignment'
      );
      expect(found).toHaveLength(2);
      return found;
    });
    const zones = container.querySelectorAll('.layout-ref-editor__zone');
    expect(zones[1]).not.toHaveClass('is-highlighted');

    fireEvent.focusIn(rows[1].querySelector('input')!);
    expect(zones[1]).toHaveClass('is-highlighted');
    expect(zones[0]).not.toHaveClass('is-highlighted');

    fireEvent.focusOut(rows[1].querySelector('input')!);
    expect(zones[1]).not.toHaveClass('is-highlighted');
  });
});
