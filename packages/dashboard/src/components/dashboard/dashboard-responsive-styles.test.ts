import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, '..');

const readComponentStyle = (relativePath: string) =>
  readFileSync(resolve(componentDir, relativePath), 'utf8');

describe('dashboard responsive styles', () => {
  it('stacks the dashboard shell and keeps content reachable on phone-width screens', () => {
    const dashboardStyles = readComponentStyle('dashboard/dashboard.scss');

    expect(dashboardStyles).toContain('@media (max-width: 48em)');
    expect(dashboardStyles).toContain('flex-direction: column');
    expect(dashboardStyles).toContain('-webkit-overflow-scrolling: touch');
  });

  it('turns the side panel into a horizontally scrollable mobile navigation', () => {
    const sidepanelStyles = readComponentStyle('sidepanel/sidepanel.scss');

    expect(sidepanelStyles).toContain('@media (max-width: 48em)');
    expect(sidepanelStyles).toContain('border-bottom');
    expect(sidepanelStyles).toContain('flex-direction: row');
    expect(sidepanelStyles).toContain('overflow-x: auto');
  });

  it('lets topbar controls wrap instead of overflowing narrow screens', () => {
    const topbarStyles = readComponentStyle('topbar/topbar.scss');
    const searchStyles = readComponentStyle('search/search.scss');

    expect(topbarStyles).toContain('flex-wrap: wrap');
    expect(topbarStyles).toContain('flex: 1 1 100%');
    expect(searchStyles).toContain('order: -1');
    expect(searchStyles).toContain('width: 100%');
  });
});
