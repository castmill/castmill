// @vitest-environment jsdom

import { render, waitFor } from '@solidjs/testing-library';
import { Cache } from '@castmill/cache';
import { TemplateComponentType } from '@castmill/player';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { WidgetView } from '../../playlists/components/widget-view';

beforeAll(() => {
  vi.spyOn(Cache.prototype, 'init').mockResolvedValue();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('widget editor preview rendering', () => {
  it('renders a template through the real player', async () => {
    const { container } = render(() => (
      <WidgetView
        widget={
          {
            name: 'Preview',
            slug: 'preview',
            aspect_ratio: '16:9',
            template: {
              type: TemplateComponentType.Group,
              name: 'root',
              opts: {},
              style: {
                width: '100%',
                height: '100%',
                'background-color': '#1a1a2e',
              },
              components: [
                {
                  type: TemplateComponentType.Text,
                  name: 'headline',
                  opts: { text: 'Visible preview' },
                  style: { color: '#fff' },
                },
              ],
            },
          } as any
        }
        config={{ widget_id: 0, data: {}, options: {} }}
        options={{}}
      />
    ));

    await waitFor(() => {
      expect(
        container.querySelector('[data-component="group"]')
      ).not.toBeNull();
      expect(container.textContent).toContain('Visible preview');
    });
  });
});
