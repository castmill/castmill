import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'sass';

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

  it('visually hides narrow-screen link labels without removing their accessible names', () => {
    const element = document.createElement('style');
    element.textContent = compile(
      resolve(componentDir, 'topbar-link/topbar-link.scss')
    ).css;
    document.head.appendChild(element);
    const rules = Array.from(element.sheet!.cssRules);
    element.remove();

    const media = rules.find(
      (rule) =>
        rule.type === CSSRule.MEDIA_RULE &&
        (rule as CSSMediaRule).conditionText === '(max-width: 36em)'
    ) as CSSMediaRule;
    expect(media).toBeDefined();
    const label = Array.from(media.cssRules).find(
      (rule) =>
        (rule as CSSStyleRule).selectorText === '.castmill-topbar-link a span'
    ) as CSSStyleRule;
    expect(label).toBeDefined();
    expect(label.style.getPropertyValue('display')).not.toBe('none');
    expect(label.style.getPropertyValue('visibility')).not.toBe('hidden');
    expect(label.style.getPropertyValue('position')).toBe('absolute');
    expect(label.style.getPropertyValue('clip-path')).toBe('inset(50%)');
    expect(label.style.getPropertyValue('overflow')).toBe('hidden');
  });
});
