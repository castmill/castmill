import { cleanup, render, waitFor } from '@solidjs/testing-library';
import type { JsonPlaylist } from '@castmill/player';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetView } from './widget-view';

const mocks = vi.hoisted(() => ({
  fromJSON: vi.fn(
    (
      _playlist: JsonPlaylist,
      _resourceManager?: unknown,
      _globals?: unknown
    ) => ({})
  ),
  cacheInit: vi.fn(async () => {}),
}));

vi.mock('@castmill/cache', () => ({
  Cache: class {
    init = mocks.cacheInit;
  },
  ResourceManager: class {},
  StorageDummy: class {},
}));

vi.mock('@castmill/player', async () => {
  const actual =
    await vi.importActual<typeof import('@castmill/player')>(
      '@castmill/player'
    );
  return {
    ...actual,
    Playlist: { fromJSON: mocks.fromJSON },
    PlayerUIControls: class {
      destroy() {}
    },
    PlayerUI: class {
      seek() {
        return {
          subscribe: ({ complete }: { complete: () => void }) => complete(),
        };
      }
      stop() {}
      destroy() {}
    },
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('WidgetView', () => {
  it.each([
    { id: 1, name: 'Image', template: {}, options_schema: {} },
    {
      id: 2,
      name: 'Listing',
      template: {},
      options_schema: { estate_id: { type: 'string' as const } },
    },
  ])('renders the preview for $name widgets', async (widget) => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);

    const { container } = render(() => (
      <WidgetView widget={widget} config={{ options: {} }} options={{}} />
    ));

    expect(container.querySelector('#player-widget')).not.toBeNull();
    await waitFor(() => expect(mocks.fromJSON).toHaveBeenCalled());
    expect(mocks.fromJSON.mock.calls[0][0].items[0].widget).toEqual(widget);
    expect(mocks.fromJSON.mock.calls[0][2]).toMatchObject({
      target: 'preview',
      freezePreviewDuringLoad: true,
    });
  });

  it.each([
    { aspect: '16:9', width: 600, height: 337.5 },
    { aspect: '9:16', width: 207, height: 368 },
    { aspect: undefined, width: 600, height: 368 },
  ])(
    'reserves toolbar height when fitting aspect ratio $aspect',
    async ({ aspect, width, height }) => {
      let raf: FrameRequestCallback | undefined;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (callback) => {
          raf = callback;
          return 1;
        }
      );
      const observe = vi.fn();
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe = observe;
          disconnect() {}
        }
      );
      const { container } = render(() => (
        <WidgetView
          widget={{
            id: 1,
            name: 'Preview',
            template: {},
            aspect_ratio: aspect,
          }}
          config={{ options: {} }}
          options={{}}
        />
      ));
      const player = container.querySelector<HTMLElement>('#player-widget')!;
      const controls =
        container.querySelector<HTMLElement>('#controls-widget')!;
      const frame = player.parentElement!;
      const available = frame.parentElement!;
      frame.style.paddingBottom = '32px';
      available.style.padding = '0px';
      vi.spyOn(available, 'getBoundingClientRect').mockReturnValue({
        width: 600,
        height: 400,
      } as DOMRect);
      raf?.(0);

      expect(observe).toHaveBeenCalledWith(available);
      expect(frame.style.width).toBe(`${width}px`);
      expect(frame.style.height).toBe(`${height}px`);
      expect(frame.style.getPropertyValue('--preview-available-width')).toBe(
        '600px'
      );
      expect(controls.parentElement).toBe(frame);
    }
  );
});
