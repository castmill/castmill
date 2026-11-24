import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BaseMenu } from './basemenu.component';

describe('BaseMenu', () => {
  afterEach(cleanup);

  it('draws submenu arrows without font glyphs', async () => {
    render(() => (
      <BaseMenu
        header={<h1>Menu</h1>}
        footer={<p>footer</p>}
        entries={[
          {
            id: 'settings',
            type: 'submenu',
            name: 'Settings',
            children: [
              { id: 'x', type: 'action', name: 'Inside', action: vi.fn() },
            ],
          },
        ]}
      />
    ));
    fireEvent.click(window);

    const header = await screen.findByText('Settings');
    // Rows are rebuilt when a submenu opens: look the header up each time.
    const arrow = () => screen.getByText('Settings').querySelector('svg')!;
    // Some players' fonts have no "▶" and showed an empty box.
    expect(header.textContent).not.toMatch(/[▶▼]/);
    expect(arrow().getAttribute('data-expanded')).toBe('false');

    fireEvent.click(header);
    expect(await screen.findByText('Inside')).toBeTruthy();
    expect(arrow().getAttribute('data-expanded')).toBe('true');
  });
});
